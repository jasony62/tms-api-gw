const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const EventEmitter = require('events')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')

class GatewayEmitter extends EventEmitter {}

class ConfigError extends Error {
  constructor(msg) {
    super(msg)
  }
}

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

    const { port, proxy, trace, quota, auth } = require(filename)

    instance = Object.assign(new Config(), {
      port,
      proxy,
      trace,
      quota,
      auth
    })

    return instance
  }
})()
/**
 * 应用运行环境
 */
class Context {
  constructor(config) {
    this.config = config
    this.emitter = new GatewayEmitter()
  }
}
Context.ins = (function() {
  let ctx
  return async function() {
    if (ctx) return ctx

    const config = await Config.ins()

    ctx = new Context(config)

    /* trace */
    if (config.trace && config.trace.mongodb) {
      const MongoContext = require('./mongo')
      const mongo = await MongoContext.ins(config.trace.mongodb)
      const trace = require('./trace')(ctx.emitter, mongo.mongoose)
      ctx.trace = trace
    }
    /* quota */
    if (config.quota && config.quota.mongodb) {
      const MongoContext = require('./mongo')
      const mongo = await MongoContext.ins(config.quota.mongodb)
      const quota = require('./quota')(ctx.emitter, mongo.mongoose)
      ctx.quota = quota
    }
    /* auth */
    if (config.auth) {
      const auth = require('./auth')(config.auth)
      ctx.auth = auth
    }

    return ctx
  }
})()

module.exports = Context
