const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')
const _ = require('lodash')

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
    })
    req.on('end', () => {
      resolve(body)
    })
  })
}

/**
 * API调用追踪
 */
class Trace {
  constructor(model) {
    this.model = model
  }
  /**
   * 记录请求的原始信息
   *
   * @param {*} req
   */
  logRecvReq(req) {
    logger.debug('logRecvReq enter')
    const { method, headers, url } = req
    const requestId = headers['x-request-id']
    const recvUrl = _.pick(require('url').parse(url, true), [
      'protocol',
      'hostname',
      'port',
      'pathname',
      'query'
    ])
    this.model.create(
      { requestId, recvUrl, method, recvHeaders: headers },
      err => {
        if (err) logger.warn('TraceLog.create', err)
      }
    )
  }
  async logSendReq(proxyReq, req, res, options) {
    logger.debug('logSendReq enter')
    const sendUrl = _.pick(options.target, [
      'protocol',
      'hostname',
      'port',
      'pathname'
    ])
    const requestId = req.headers['x-request-id']
    const clientId = req.headers['x-request-client']

    let recvBody
    if ('POST' == req.method) recvBody = await parseBody(req)
    await this.model.updateOne(
      { requestId },
      { $set: { clientId, sendUrl, recvBody } }
    )
  }
  logResponse(proxyRes, req, res) {
    logger.debug('logResponse enter')
    let body = []
    proxyRes.on('data', chunk => {
      body.push(chunk)
    })
    proxyRes.on('end', async () => {
      body = Buffer.concat(body).toString()
      const requestId = req.headers['x-request-id']
      const requestAt = req.headers['x-request-at']
      const elapseMs = new Date() * 1 - requestAt
      const { statusCode, statusMessage, headers } = proxyRes
      await this.model.updateOne(
        { requestId },
        {
          $set: {
            statusCode,
            statusMessage,
            responseHeaders: headers,
            responseBody: body,
            elapseMs
          }
        }
      )
      res.end(body)
    })
  }
}
Trace.createModel = function(mongoose) {
  const Schema = mongoose.Schema

  // 记录原始请求数据的collection
  const Model = mongoose.model(
    'trace_log',
    new Schema(
      {
        requestId: String,
        requestAt: { type: Date, default: Date.now },
        clientId: String,
        recvUrl: {
          protocol: String,
          hostname: String,
          port: String,
          pathname: String,
          query: Object
        },
        method: String,
        recvHeaders: Object,
        recvBody: String,
        sendUrl: {
          protocol: String,
          hostname: String,
          port: String,
          pathname: String,
          query: Object
        },
        statusCode: { type: Number, default: 0 },
        statusMessage: { type: String, default: '' },
        responseHeaders: { type: Object, default: {} },
        responseBody: { type: String, default: '' },
        elapseMs: { type: Number, default: 0 }
      },
      { collection: 'trace_log' }
    )
  )

  return Model
}

module.exports = (function() {
  let _instance
  return function(emitter, mongoose) {
    if (_instance) return _instance

    let Model = Trace.createModel(mongoose)

    _instance = new Trace(Model)

    emitter.on('recvReq', _instance.logRecvReq.bind(_instance))
    emitter.on('proxyReq', _instance.logSendReq.bind(_instance))
    emitter.on('proxyRes', _instance.logResponse.bind(_instance))

    return _instance
  }
})()
