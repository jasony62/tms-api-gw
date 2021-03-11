const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')
const _ = require('lodash')
const gatewayConfig = require('../../config/gateway')

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
  constructor(mongodbModel = null, sendModel = null) {
    this.mongodbModel = mongodbModel
    this.sendModel = sendModel
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
    const datas = { requestId, recvUrl, method, recvHeaders: headers }
    if (this.mongodbModel) {
      this.mongodbModel.create(
        datas,
        err => {
          if (err) logger.warn('TraceLog.create', err)
        }
      )
    }
    if (this.sendModel) {
      this.sendModel("recvReq", requestId, "", datas)
    }
    return 
  }
  async logSendReq(proxyReq, req, res, options) {
    logger.debug('logSendReq enter ' + req.originUrl)
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
    const datas = { clientId, sendUrl, recvBody }
    if (this.mongodbModel) {
      await this.mongodbModel.updateOne( { requestId }, { $set: datas } )
    }
    if (this.sendModel) {
      this.sendModel("sendReq", requestId, clientId, datas)
    }
    return 
  }
  logResponse(proxyRes, req, res) {
    logger.debug('logResponse enter ' + req.targetUrl)

    if (gatewayConfig.trace.onlyError === true && proxyRes.statusCode === 200) {
      return
    }

    let body = []
    proxyRes.on('data', chunk => {
      body.push(chunk)
    })
    proxyRes.on('end', async () => {
      body = Buffer.concat(body).toString()
      const requestId = req.headers['x-request-id']
      const requestAt = req.headers['x-request-at']
      const clientId = req.headers['x-request-client']
      const elapseMs = new Date() * 1 - requestAt
      const { statusCode, statusMessage, headers } = proxyRes
      const datas = {
        statusCode,
        statusMessage,
        responseHeaders: headers,
        responseBody: body,
        elapseMs
      }
      if (this.mongodbModel) {
        await this.mongodbModel.updateOne( { requestId }, { $set: datas } )
      }
      if (this.sendModel) {
        await this.sendModel("response", requestId, clientId, datas)
      }
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
Trace.createSendModel = function(thirdConfig) {
  const axios = require('axios')
  const adapter = require('axios/lib/adapters/http')

  const { url, events } = thirdConfig
  return function(event, requestId, clientId = "", datas) {
    (() => {
      if (events && !events.includes(event)) return // 只发送指定事件，默认都发送

      const options = { 
        adapter,
        // timeout: 3000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
      const instance = axios.create(options)
      let headers = {
        "x-request-event": event,
        "x-request-id": requestId
      }
      if (clientId) headers["x-request-client"] = clientId

      return instance
        .post(url, datas, { headers })
        .catch( err => {
          logger.error('sendLog err ', err)
          return
        })
    })()
    return 
  }
}
module.exports = (function() {
  let _instance
  return function(emitter, mongoose, thirdConfig) {
    if (_instance) return _instance

    let mongodbModel, sendModel
    if (mongoose) 
      mongodbModel = Trace.createModel(mongoose)
    if (thirdConfig) 
      sendModel = Trace.createSendModel(thirdConfig)

    _instance = new Trace(mongodbModel, sendModel)

    emitter.on('recvReq', _instance.logRecvReq.bind(_instance))
    emitter.on('proxyReq', _instance.logSendReq.bind(_instance))
    emitter.on('proxyRes', _instance.logResponse.bind(_instance))

    return _instance
  }
})()
