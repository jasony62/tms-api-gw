const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')
const _ = require('lodash')
const PATH = require("path")
const fs = require("fs")

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

function _getTargetTrace(TraceObj, targetRule) {
  let targetTraces
  if (targetRule.trace && Array.isArray(targetRule.trace)) {
    targetTraces = targetRule.trace
  } else {
    targetTraces = TraceObj.config.default
  }
  return targetTraces
}

async function _pushMessage(targetTc, ctx, req, event, pushUrl, datas, oHeaders = {}) {
  const { headers } = req
  const requestId = headers['x-request-id']
  const requestAt = headers['x-request-at']
  let clientId = req.headers['x-request-client'] || ""

  let beforeFunc
  if (targetTc.before && typeof targetTc.before === "string") {
    const authPath = PATH.resolve(targetTc.before)
    if (fs.existsSync(authPath)) {
      beforeFunc = require(authPath)
    }
  } else if (typeof targetTc.before === "function") {
    beforeFunc = targetTc.before
  }
  if (typeof beforeFunc === "function") {
    await beforeFunc(req, event, clientId, oHeaders, datas)
  }

  if (ctx.pushMessage) {
    ctx.pushMessage.publish({ 
      event, 
      pushUrl,
      requestId, 
      requestAt,
      clientId, 
      headers: oHeaders,
      datas
    })
  }
  return true
}

async function _eventTrace(req, ctx, TraceObj, event, datas) {
  let targetTraces = _getTargetTrace(TraceObj, req.targetRule)

  const { headers } = req
  const requestId = headers['x-request-id']
  if (Array.isArray(targetTraces)) {
    for (const tc of targetTraces) {
      const targetTc = TraceObj.traceInstanceMap.get(tc)
      if (!targetTc.type) targetTc.type = "mongodb"
      if (targetTc.events && !targetTc.events.includes(event))
          continue
      if (targetTc.type === "mongodb") {
        if (event === "recvReq") {
          targetTc.mongoose.create(
            datas,
            err => {
              if (err) logger.warn('TraceLog.create', err)
            }
          )
        } else {
          targetTc.mongoose.updateOne( { requestId }, { $set: datas } ).then( r => r )
        }
      } else if (targetTc.type === "http") {
        _pushMessage(targetTc, ctx, req, event, targetTc.url, datas)
      }
    }
  }

  return true
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
   * 记录请求的原始信息
   *
   * @param {*} req
   */
  async logRecvReq(req, res, ctx) {
    logger.debug('logRecvReq enter')
    const { method, headers, originUrl: url, targetRule } = req
    const requestId = headers['x-request-id']
    const recvUrl = _.pick(require('url').parse(url, true), [
      'protocol',
      'hostname',
      'port',
      'pathname',
      'query'
    ])
    
    const datas = { requestId, recvUrl, method, recvHeaders: headers }
    _eventTrace(req, ctx, this, "recvReq", datas)

    return 
  }

  async logSendReq(proxyReq, req, res, options, ctx) {
    logger.debug('logSendReq enter ' + req.originUrl)
    const sendUrl = _.pick(options.target, [
      'protocol',
      'hostname',
      'port',
      'pathname',
      'query'
    ])
    const clientId = req.headers['x-request-client']

    let recvBody
    if ('POST' == req.method) recvBody = await parseBody(req)
    const datas = { clientId, sendUrl, sendHeaders: req.headers, recvBody }

    _eventTrace(req, ctx, this, "sendReq", datas)
    
    return 
  }

  async logResponse(proxyRes, req, res, ctx) {
    logger.debug('logResponse enter ' + req.originUrl)

    if (this.config.onlyError === true && proxyRes.statusCode === 200) {
      return
    }

    let body = []
    proxyRes.on('data', chunk => {
      body.push(chunk)
    })
    proxyRes.on('end', async () => {
      body = Buffer.concat(body).toString()
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
      _eventTrace(req, ctx, this, "response", datas)
    })
  }

  async logCheckpointReq(req, res, ctx, type, error) {
    if (!type) 
      return 

    let checkpointStatus = {}
    checkpointStatus[type] = error.msg

    const clientId = req.headers['x-request-client']
    const datas = { checkpointStatus, clientId }
    _eventTrace(req, ctx, this, "checkpoint", datas)

    return 
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
        sendHeaders: Object,
        statusCode: { type: Number, default: 0 },
        statusMessage: { type: String, default: '' },
        responseHeaders: { type: Object, default: {} },
        responseBody: { type: String, default: '' },
        elapseMs: { type: Number, default: 0 },
        checkpointStatus: {
          auth: String,
          quota: String
        }
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
    emitter.on('checkpointReq', _instance.logCheckpointReq.bind(_instance))
    emitter.on('proxyReq', _instance.logSendReq.bind(_instance))
    emitter.on('proxyRes', _instance.logResponse.bind(_instance))

    return _instance
  }
})()
