const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw-trace')
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

  let pushHeaders = Object.assign({}, {"x-request-event": event, "x-request-id": requestId, "x-request-at": requestAt, "x-request-client": clientId}, oHeaders)

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
    await beforeFunc(req, event, clientId, pushHeaders, datas)
  }

  if (ctx.pushMessage) {
    await ctx.pushMessage.publish({ 
      event, 
      pushUrl,
      requestId, 
      requestAt,
      clientId, 
      headers: pushHeaders,
      datas
    })
  }
  return true
}

async function _eventTrace(req, ctx, TraceObj, event, datas, options = {}) {
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
          await targetTc.mongoose.create(
            datas,
            err => {
              if (err) logger.error(`TraceLog.create || ${req.headers['x-request-id']} || ${req.originUrl} || ${new Date() * 1 - req.headers['x-request-at']}`, err)
            }
          )
        } else if (event === "response") {
          if (targetTc.onlyError === true && options.proxyRes.statusCode === 200) { // 只在发生错误时获取body数据
            await targetTc.mongoose.updateOne( { requestId }, { $set: datas } )
          } else {
            const rstBody = await options.getResBody.get(options.proxyRes)
            datas.responseBody = rstBody
            await targetTc.mongoose.updateOne( { requestId }, { $set: datas } )
          }
        } else {
          await targetTc.mongoose.updateOne( { requestId }, { $set: datas } )
        }
      } else if (targetTc.type === "http") {
        if (event === "response") {
          if (targetTc.sendOnlyError === true && options.proxyRes.statusCode === 200) { // 只发送错误日志
            continue
          }
          if (targetTc.onlyError !== true || (targetTc.onlyError === true && options.proxyRes.statusCode !== 200)) {  // 只在发生错误时获取body数据
            const rstBody = await options.getResBody.get(options.proxyRes)
            datas.responseBody = rstBody
          } else {
            delete datas.responseBody
          }
        }
        await _pushMessage(targetTc, ctx, req, event, targetTc.url, datas)
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
    const { method, headers, originUrl: url } = req
    const requestId = headers['x-request-id']
    const recvUrl = _.pick(require('url').parse(url, true), [
      'protocol',
      'hostname',
      'port',
      'pathname',
      'query'
    ])
    
    const datas = { requestId, recvUrl, method, recvHeaders: headers, requestAt: req.headers['x-request-at'] }
    _eventTrace(req, ctx, this, "recvReq", datas)

    logger.debug(`logRecvReq || ${req.headers['x-request-id']} || ${req.originUrl} || ${new Date() * 1 - req.headers['x-request-at']}`)
    return 
  }

  async logSendReq(proxyReq, req, res, options, ctx) {
    const sendUrl = _.pick(require('url').parse(req.targetUrl, true), [
      'protocol',
      'hostname',
      'port',
      'pathname',
      'query'
    ])

    let recvBody
    if ('POST' == req.method) recvBody = await parseBody(req)
    const current = new Date() * 1
    const send_elapseMs = current - req.headers['x-request-at']
    const datas = { sendUrl, sendHeaders: req.headers, recvBody, send_elapseMs, reqSendAt: current }

    _eventTrace(req, ctx, this, "sendReq", datas)

    logger.debug(`logSendReq || ${req.headers['x-request-id']} || ${req.originUrl} || ${send_elapseMs}`)
    return 
  }

  async logResponse(proxyRes, req, res, ctx) {
    const current = new Date() * 1
    const requestAt = req.headers['x-request-at']
    const res_elapseMs = current - requestAt
    const { statusCode, statusMessage, headers } = proxyRes
    const datas = {
      statusCode,
      statusMessage,
      responseHeaders: headers,
      res_elapseMs,
      responseAt: current
    }

    const getResBody = {
      body: null,
      get: async function(proxyRes2) {
        if (this.body !== null) return this.body
        return new Promise((resolve, reject) => {
          let rst = []
          proxyRes2.on('data', chunk => {
            rst.push(chunk)
          })
          proxyRes2.on('end', async () => {
            rst = Buffer.concat(rst).toString()
            this.body = rst
            return resolve(this.body)
          })
        })
      }
    }

    _eventTrace(req, ctx, this, "response", datas, { proxyRes, getResBody })
    logger.debug(`logResponse || ${req.headers['x-request-id']} || ${req.originUrl} || ${res_elapseMs}`)
  }

  async logCheckpointReq(req, res, ctx, type, error = "") {
    let current = new Date() * 1

    if (!type) 
      return 

    let checkpointStatus = {}, checkpointStatusMsg = "passe"

    if (error) checkpointStatusMsg = error.msg
    checkpointStatus[type] = checkpointStatusMsg

    const clientId = req.headers['x-request-client']
    let datas = { checkpointStatus, clientId }
    if (type === "auth") {
      datas.auth_elapseMs = current - req.headers['x-request-at']
      datas.clientInfo = req.clientInfo
    } else if (type === "error") {
      datas.reqErrorAt = current
      datas.err_elapseMs = current - req.headers['x-request-at']
    } else if (type === "transformRequest") {
      datas.transformRequest_elapseMs = current - req.headers['x-request-at']
    } else if (type === "quota") {
      datas.quota_elapseMs = current - req.headers['x-request-at']
    }

    _eventTrace(req, ctx, this, "checkpoint", datas)

    let msg = `logCheckpointReq ${type} || ${req.headers['x-request-id']} || ${req.originUrl} || ${current - req.headers['x-request-at']}`
    if ( error ) logger.error(msg, error)
    else logger.debug(msg)

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
        requestAt: { type: Date },
        clientId: String,
        clientInfo: { type: Object, default: {} },
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
        reqSendAt: { type: Date },
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
        responseAt: { type: Date },
        responseHeaders: { type: Object, default: {} },
        responseBody: { type: String, default: '' },
        auth_elapseMs: { type: Number, default: 0 },
        quota_elapseMs: { type: Number, default: 0 },
        transformRequest_elapseMs: { type: Number, default: 0 },
        send_elapseMs: { type: Number, default: 0 },
        res_elapseMs: { type: Number, default: 0 },
        checkpointStatus: {
          auth: String,
          quota: String,
          error: String
        },
        reqErrorAt: { type: Date },
        err_elapseMs: { type: Number, default: 0 },
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
    let { enable, default: defaultTrace, ...traces } = config

    let traceInstanceMap = new Map()
    let mongodbModelMap = new Map()
    for (const key in traces) {
      const val = traces[key]
      if (val.type === "mongodb") {
        const mongoName = `${val.host}:${val.port}`
        if (!mongodbModelMap.get(mongoName)) {
          const mongo = await MongoContext.ins(val)
          const mongodbModel = Trace.createModel(mongo.mongoose)
          mongodbModelMap.set(mongoName, mongodbModel)
          val.mongoose = mongodbModel
        } else {
          val.mongoose = mongodbModelMap.get(mongoName)
        }
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
