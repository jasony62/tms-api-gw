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
  constructor(config, traceInstanceMap) {
    this.config = config
    this.traceInstanceMap = traceInstanceMap
  }
  /**
   * 
   */
  getTargetTrace(targetRule) {
    let targetTraces
    if (targetRule.trace && Array.isArray(targetRule.trace)) {
      targetTraces = targetRule.trace
    } else {
      targetTraces = this.config.default
    }
    return targetTraces
  }
  /**
   * 记录请求的原始信息
   *
   * @param {*} req
   */
  logRecvReq(req, res, ctx) {
    logger.debug('logRecvReq enter')
    const { method, headers, url, targetRule } = req
    const requestId = headers['x-request-id']
    const requestAt = headers['x-request-at']
    const recvUrl = _.pick(require('url').parse(url, true), [
      'protocol',
      'hostname',
      'port',
      'pathname',
      'query'
    ])
    const datas = { requestId, recvUrl, method, recvHeaders: headers }
    
    let targetTraces = this.getTargetTrace(targetRule)
    if (Array.isArray(targetTraces)) {
      for (const tc of targetTraces) {
        if (this.traceInstanceMap.has(tc)) {
          const instances = this.traceInstanceMap.get(tc)
          if (instances.events && !instances.events.includes("recvReq"))
              continue
          if (instances.type === "mongodb") {
            instances.mongoose.create(
              datas,
              err => {
                if (err) logger.warn('TraceLog.create', err)
              }
            )
          } else if (instances.type === "http") {
            if (ctx.pushMessage) {
              ctx.pushMessage.publish({ 
                event: "recvReq", 
                requestId, 
                requestAt,
                clientId: "", 
                datas 
              })
            }
          }
        }
      }
    }

    return 
  }
  async logSendReq(proxyReq, req, res, options, ctx) {
    logger.debug('logSendReq enter ' + req.originUrl)
    const sendUrl = _.pick(options.target, [
      'protocol',
      'hostname',
      'port',
      'pathname'
    ])
    const requestId = req.headers['x-request-id']
    const clientId = req.headers['x-request-client']
    const requestAt = req.headers['x-request-at']

    let recvBody
    if ('POST' == req.method) recvBody = await parseBody(req)
    const datas = { clientId, sendUrl, recvBody }

    let targetTraces = this.getTargetTrace(req.targetRule)
    if (Array.isArray(targetTraces)) {
      for (const tc of targetTraces) {
        if (this.traceInstanceMap.has(tc)) {
          const instances = this.traceInstanceMap.get(tc)
          if (instances.events && !instances.events.includes("sendReq"))
              continue
          if (instances.type === "mongodb") {
            instances.mongoose.updateOne( { requestId }, { $set: datas } )
          } else if (instances.type === "http") {
            if (ctx.pushMessage) {
              ctx.pushMessage.publish({ 
                event: "sendReq", 
                requestId, 
                requestAt,
                clientId, 
                datas 
              })
            }
          }
        }
      }
    }
    return 
  }
  logResponse(proxyRes, req, res, ctx) {
    logger.debug('logResponse enter ' + req.targetUrl)

    if (this.config.onlyError === true && proxyRes.statusCode === 200) {
      return
    }

    let body = []
    proxyRes.on('data', chunk => {
      body.push(chunk)
    })
    proxyRes.on('end', async () => {
      body = Buffer.concat(body).toString()
      const clientId = req.headers['x-request-client']
      const requestId = req.headers['x-request-id']
      const requestAt = req.headers['x-request-at']
      const elapseMs = new Date() * 1 - requestAt
      const { statusCode, statusMessage, headers } = proxyRes
      const datas = {
        statusCode,
        statusMessage,
        responseHeaders: headers,
        responseBody: body,
        elapseMs
      }
      let targetTraces = this.getTargetTrace(req.targetRule)
      if (Array.isArray(targetTraces)) {
        for (const tc of targetTraces) {
          if (this.traceInstanceMap.has(tc)) {
            const instances = this.traceInstanceMap.get(tc)
            if (instances.events && !instances.events.includes("response"))
                continue
            if (instances.type === "mongodb") {
              await instances.mongoose.updateOne( { requestId }, { $set: datas } )
            } else if (instances.type === "http") {
              if (ctx.pushMessage) {
                ctx.pushMessage.publish({ 
                  event: "response", 
                  requestId, 
                  requestAt,
                  clientId, 
                  datas 
                })
              }
            }
          }
        }
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
module.exports = (function() {
  let _instance
  return async function(emitter, config) {
    if (_instance) return _instance

    const MongoContext = require('../mongo')
    let { enable, onlyError, default: defaultTrace, ...traces } = config

    let traceInstanceMap = new Map()
    for (const key in traces) {
      const val = traces[key]
      if (val.type === "mongodb") {
        const mongo = await MongoContext.ins(val)
        const mongodbModel = Trace.createModel(mongo.mongoose)
        val.mongoose = mongodbModel
      }
      traceInstanceMap.set(key, val)
    }
    
    _instance = new Trace(config, traceInstanceMap)

    emitter.on('recvReq', _instance.logRecvReq.bind(_instance))
    emitter.on('proxyReq', _instance.logSendReq.bind(_instance))
    emitter.on('proxyRes', _instance.logResponse.bind(_instance))

    return _instance
  }
})()
