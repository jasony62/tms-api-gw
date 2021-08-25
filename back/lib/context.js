const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const EventEmitter = require('events')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw_ctx')

/**
 * 获得配置数据
 */
function loadConfig(name, defaultConfig, reload = "N") {
  let basepath = path.resolve('config', `${name}.js`)
  let baseConfig
  if (fs.existsSync(basepath)) {
    if (reload === "Y") delete require.cache[basepath]
    baseConfig = require(basepath)
    logger.info(`从[${basepath}]加载配置`)
  } else {
    logger.warn(`[${name}]配置文件[${basepath}]不存在`)
  }
  let localpath = path.resolve('config', `${name}.local.js`)
  let localConfig
  if (fs.existsSync(localpath)) {
    if (reload === "Y") delete require.cache[localpath]
    localConfig = require(localpath)
    logger.info(`从[${localpath}]加载本地配置`)
  }
  if (defaultConfig || baseConfig || localConfig) {
    return _.merge({}, defaultConfig, baseConfig, localConfig)
  }

  return false
}

class GatewayEmitter extends EventEmitter { }

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
Config.ins = (function () {
  let _ins
  return async function (reload = "N") {
    if (_ins && reload === "N") return _ins
    const { port, proxy, trace, quota, auth, transformRequest, pushMessage, API } = loadConfig("gateway", {}, "Y")
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
    /* API */
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
Context.hotUpdate = async function() {
  const ctx = await Context.ins()
  const config = await Config.ins("Y")

  /* proxy */
  ctx.config.proxy.rules = config.proxy.rules
  /* trace */
  if (!config.trace && ctx.trace) {
    delete ctx.config.trace
    delete ctx.trace
  }
  /* quota */
  if (!config.quota && ctx.quota) {
    delete ctx.config.quota
    delete ctx.quota
  }
  /* auth */
  if (!config.auth && ctx.auth) {
    delete ctx.config.auth
    delete ctx.auth
  }
  /* transformRequest */
  if (!config.transformRequest && ctx.transformRequest) {
    delete ctx.config.transformRequest
    delete ctx.transformRequest
  }
  /* pushMessage */
  if (!config.pushMessage && ctx.pushMessage) {
    delete ctx.config.pushMessage
    delete ctx.pushMessage
  }
  /* API */
  if (!config.API && ctx.API) {
    delete ctx.config.API
    delete ctx.API
  } else if (config.API && ctx.API && !config.API.controllers && ctx.API.controllers) {
    delete ctx.config.controllers
    delete ctx.API.controllers
  } else if (config.API && ctx.API && !config.API.metrics && ctx.API.metrics) {
    delete ctx.config.metrics
    delete ctx.API.metrics
  }

  return ctx
}

module.exports = { Context, Config, loadConfig }
