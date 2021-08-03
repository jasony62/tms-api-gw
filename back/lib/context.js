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

    const { port, proxy, trace, quota, auth, transformRequest, pushMessage, API } = require(filename)
    _ins = new Config(port, proxy)
    if (trace && (trace.enable === undefined || trace.enable === true))
      _ins.trace = trace
    if (quota && (quota.enable === undefined || quota.enable === true))
      _ins.quota = quota
    if (auth && (auth.enable === undefined || auth.enable === true))
      _ins.auth = auth
    if (transformRequest && (transformRequest.enable === undefined || transformRequest.enable === true))
      _ins.transformRequest = transformRequest
    if (pushMessage && (pushMessage.enable === undefined || pushMessage.enable === true))
      _ins.pushMessage = pushMessage
    if (API && API.enable === true) {
      _ins.API = Object.assign({}, API)
      if (!API.controllers || API.controllers.enable !== true)
        delete _ins.API.controllers
      if (!API.metrics || API.metrics.enable !== true)
        delete _ins.API.metrics
    }

    logger.info('日志服务：', _ins.trace ? '打开' : '否')
    logger.info('配额服务：', _ins.quota ? '打开' : '否')
    logger.info('认证服务：', _ins.auth ? '打开' : '否')
    logger.info('转换请求服务：', _ins.transformRequest ? '打开' : '否')
    logger.info('消息推送服务：', _ins.pushMessage ? '打开' : '否')
    logger.info('API服务：', _ins.API ? '打开' : '否')
    logger.info('API-监控服务：', _ins.API && _ins.API.metrics ? '打开' : '否')
    logger.info('API-接口服务：', _ins.API && _ins.API.controllers ? '打开' : '否')

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
    if (config.trace) {
      let trace = await require('./trace')(ctx.emitter, config.trace)
      ctx.trace = trace
    }
    /* quota */
    if (config.quota) {
      const MongoContext = require('./mongo')
      const mongo = await MongoContext.ins(config.quota.mongodb)
      const quota = require('./quota')(
        ctx.emitter,
        mongo.mongoose,
        config.quota
      )
      ctx.quota = quota
    }
    /* auth */
    if (config.auth) {
      const auth = require('./auth')(config.auth)
      ctx.auth = auth
    }
    /* transformRequest */
    if (config.transformRequest) {
      const transformRequest = require('./transformRequest')(config.transformRequest)
      ctx.transformRequest = transformRequest
    }
    /* pushMessage */
    if (config.pushMessage && config.pushMessage.redis) {
      const pushMsg = require('./pushMessage')
      const instance = await pushMsg(ctx.emitter, config.pushMessage)
      ctx.pushMessage = instance
    }
    /* pushMessage */
    if (config.API) {
      ctx.API = {
        config: config.API
      }
      let _instanceCtr, _instanceMtr
      /* controller */
      if (config.API.controllers) {
        const ctr = require('./API/controllers')
        ctx.API.controllers = await ctr(ctx, config.API.controllers, config.API.router)
      }

      /* metrics */
      if (config.API.metrics) {
        const metrics = require('./API/metrics')
        ctx.API.metrics = await metrics(ctx, config.API.metrics)
      }
    }

    return ctx
  }
})()

module.exports = Context
