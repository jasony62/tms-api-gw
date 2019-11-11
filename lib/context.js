const fs = require('fs')
const path = require('path')
const log4js = require('@log4js-node/log4js-api')
const _ = require('lodash')
const logger = log4js.getLogger('tms-api-gw')

class MongoError extends Error {
  constructor(msg) {
    super(msg)
  }
}

class ConfigError extends Error {
  constructor(msg) {
    super(msg)
  }
}

/**
 * mongodb配置
 */
class MongoContext {
  constructor() {
    this.models = new Map()
  }
  /**
   * 保存完整请求数据的集合
   */
  get modelReqLog() {
    let Model = this.models.get('request_log')
    return Model
  }
}
MongoContext.connect = function(host, port, database) {
  const mongoose = require('mongoose')
  const url = `mongodb://${host}:${port}/${database}`

  mongoose.connection.on('error', function(err) {
    const msg = `mongodb操作错误：${err.message}`
    logger.error(msg, err)
    throw new MongoError(msg)
  })

  return mongoose
    .connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => {
      logger.info(`连接'${url}'成功`)
      return mongoose
    })
    .catch(err => {
      const msg = `连接'${url}'失败：${err.message}`
      logger.error(msg, err)
      return Promise.reject(new MongoError(msg))
    })
}
MongoContext.createModel = function(mongoCtx) {
  const mongoose = mongoCtx.mongoose
  const Schema = mongoose.Schema

  // 记录原始请求数据的collection
  const Model = mongoose.model(
    'request_log',
    new Schema(
      {
        requestId: String,
        requestAt: { type: Date, default: Date.now },
        cliendId: String,
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
      { collection: 'request_log' }
    )
  )

  mongoCtx.models.set('request_log', Model)

  return mongoCtx.models
}
MongoContext.ins = (function() {
  let instance
  return async function({ host, port, database }) {
    if (instance) return instance

    if (typeof host !== 'string') {
      let msg = '没有指定mongodb的主机地址'
      logger.error(msg)
      throw new MongoError(msg)
    }
    if (typeof port !== 'number') {
      let msg = '没有指定mongodb连接的端口'
      logger.error(msg)
      throw new MongoError(msg)
    }
    if (typeof database !== 'string') {
      let msg = '没有指定mongodb连接的数据库'
      logger.error(msg)
      throw new MongoError(msg)
    }

    const mongoose = await MongoContext.connect(host, port, database)

    return (instance = Object.assign(new MongoContext(), {
      host,
      port,
      database,
      mongoose
    }))
  }
})()

class Config {}
Config.ins = (function() {
  let instance
  return async function() {
    if (instance) return instance
    const filename = path.resolve('config/gateway.js')
    if (!fs.existsSync(filename)) {
      const msg = `配置文件'${filename}'不存在`
      logger.error(msg)
      return new ConfigError(msg)
    }

    const { port, proxy, storage, queue, auth, quota } = require(filename)

    instance = Object.assign(new Config(), {
      port,
      proxy,
      storage,
      queue,
      auth,
      quota
    })

    return instance
  }
})()
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
 * 应用运行环境
 */
class Context {
  constructor(config) {
    this.config = config
  }
  /**
   * 记录请求的原始信息
   *
   * @param {*} req
   * @param {string} body Post请求发送的内容
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
    const Model = this.mongo.modelReqLog
    Model.create({ requestId, recvUrl, method, recvHeaders: headers }, err => {
      if (err) logger.warn('ModelReqLog.create', err)
    })
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
    let recvBody
    if ('POST' == req.method) recvBody = await parseBody(req)
    const Model = this.mongo.modelReqLog
    await Model.updateOne({ requestId }, { $set: { sendUrl, recvBody } })
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
      const Model = this.mongo.modelReqLog
      const { statusCode, statusMessage, headers } = proxyRes
      await Model.updateOne(
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
Context.ins = (function() {
  let ctx
  return async function() {
    if (ctx) return ctx

    const config = await Config.ins()

    ctx = new Context(config)

    /* mongodb */
    const { storage } = config
    if (storage && storage.mongodb) {
      const mongoCtx = await MongoContext.ins(storage.mongodb)
      MongoContext.createModel(mongoCtx)
      ctx.mongo = mongoCtx
    }

    return ctx
  }
})()

module.exports = Context
