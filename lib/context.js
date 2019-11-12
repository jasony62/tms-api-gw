const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')

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

    const { port, proxy, trace, queue, auth, quota } = require(filename)

    instance = Object.assign(new Config(), {
      port,
      proxy,
      trace,
      queue,
      auth,
      quota
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
      const mongoCtx = await MongoContext.ins(config.trace.mongodb)
      ctx.mongo = mongoCtx
      const trace = require('./trace')(ctx.mongo.mongoose)
      ctx.trace = trace
    }

    return ctx
  }
})()

module.exports = Context
