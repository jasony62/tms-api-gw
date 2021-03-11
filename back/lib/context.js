const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const EventEmitter = require('events')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw_ctx')

class GatewayEmitter extends EventEmitter {}

class ConfigError extends Error {
  constructor(msg) {
    super(msg)
  }
}

class Config {
  constructor(port, proxy) {
    this.port = port
    this.proxy = proxy
  }
}
Config.ins = (function() {
  let _ins
  return async function() {
    if (_ins) return _ins
    const filename = path.resolve('config/gateway.js')
    if (!fs.existsSync(filename)) {
      const msg = `配置文件'${filename}'不存在`
      logger.error(msg)
      return Promise.reject(new ConfigError(msg))
    }

    const { port, proxy, trace, quota, auth } = require(filename)
    _ins = new Config(port, proxy)
    if (trace && (trace.enable === undefined || trace.enable === true))
      _ins.trace = trace
    if (quota && (quota.enable === undefined || quota.enable === true))
      _ins.quota = quota
    if (auth && (auth.enable === undefined || auth.enable === true))
      _ins.auth = auth

    logger.info('日志服务：', _ins.trace ? '打开' : '否')
    logger.info('配额服务：', _ins.quota ? '打开' : '否')
    logger.info('认证服务：', _ins.auth ? '打开' : '否')

    return _ins
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
    if (config.trace && (config.trace.mongodb || config.trace.sendThird)) {
      let trace
      if (config.trace.mongodb) {
        const MongoContext = require('./mongo')
        const mongo = await MongoContext.ins(config.trace.mongodb)
        trace = require('./trace')(ctx.emitter, mongo.mongoose, config.trace.sendThird)
      } else {
        trace = require('./trace')(ctx.emitter, "", config.trace.sendThird)
      }
      ctx.trace = trace
    }
    /* quota */
    if (config.quota && config.quota.mongodb) {
      const MongoContext = require('./mongo')
      const mongo = await MongoContext.ins(config.quota.mongodb)
      const quota = require('./quota')(
        ctx.emitter,
        mongo.mongoose,
        config.quota.rules
      )
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
