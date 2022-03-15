const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw-metrics')
const _ = require('lodash')

const PromClient = require('prom-client')
const { Registry } = PromClient

const { ProfileGateway } = require('./gateway/profile')

/** swagger服务配置信息 */
class Context {
  /**
   * 创建上下文
   *
   * @param {Object} register - 监控指标注册器
   */
  constructor(register, config) {
    this.register = register
    this.config = config
  }
  /**
   * 记录请求的原始信息
   *
   * @param {*} req
   */
  logRecvReq(req, res, ctx) {
    prometheus.metrics.gw_access.total++
    return 
  }

  logSendReq(proxyReq, req, res, options, ctx) {
    prometheus.metrics.gw_access.sendTotal++
    // api维度
    const { pathname } = _.pick(require('url').parse(req.originUrl, true), ['pathname'])
    const api_access = prometheus.metrics.api_access
    if (api_access[pathname]) {
      api_access[pathname]["sendTotal"]++
    } else {
      api_access[pathname] = {
        sendTotal: 1,
        sendFail: 0,
        sendSuccess: 0,
        sendError: 0,
        slow: 0,
      }
    }
    //用户维度
    const clientId = req.headers['x-request-client']
    if (clientId) { 
      const client_access = prometheus.metrics.client_access
      if (client_access[clientId]) {
        client_access[clientId]["sendTotal"]++
      } else {
        client_access[clientId] = {
          sendTotal: 1,
          sendFail: 0,
          sendSuccess: 0,
          sendError: 0,
          slow: 0,
        }
      }
    }
    return 
  }

  logResponse(proxyRes, req, res, ctx) {
    const clientId = req.headers['x-request-client']
    const { pathname } = _.pick(require('url').parse(req.originUrl, true), ['pathname'])
    if (proxyRes.statusCode == 200) {
      prometheus.metrics.gw_access.sendSuccess++ // 总访问量
      prometheus.metrics.api_access[pathname]["sendSuccess"]++
      if (clientId) prometheus.metrics.client_access[clientId]["sendSuccess"]++
    } else {
      prometheus.metrics.gw_access.sendFail++ // 总访问量
      prometheus.metrics.api_access[pathname]["sendFail"]++
      if (clientId) prometheus.metrics.client_access[clientId]["sendFail"]++
    }
    if (this.config.slowQueryTimeout) {
      const slowQueryTimeout = +this.config.slowQueryTimeout
      const res_elapseMs = (new Date() * 1) - req.headers['x-request-at']
      if (res_elapseMs > slowQueryTimeout) {
        prometheus.metrics.gw_access.slow++
        prometheus.metrics.api_access[pathname]["slow"]++
        if (clientId) prometheus.metrics.client_access[clientId]["slow"]++
      }
    }

    return
  }

  async logCheckpointReq(req, res, ctx, type, error = "") {
    if (!type) return 

    if (type === "error") {
      const clientId = req.headers['x-request-client']
      const { pathname } = _.pick(require('url').parse(req.originUrl, true), ['pathname'])
      prometheus.metrics.gw_access.sendError++ // 总访问量
      prometheus.metrics.api_access[pathname]["sendError"]++
      if (clientId) prometheus.metrics.client_access[clientId]["sendError"]++
    }

    return 
  }
}

module.exports = (function () {
  let _instance
  /**
   * 获得配置信息实例
   *
   * @return {Context} 配置信息实例.
   */
  return async function (ctx, metricsConfig) {
    if (_instance) return _instance

    const register = new Registry()

    let { collectDefault, gatewayProfile = { prefix: "tms_api_gw" } } = metricsConfig

    if (collectDefault === true) {
      let msg = '提供默认系统监控指标'
      logger.info(msg)
      const collectDefaultMetrics = PromClient.collectDefaultMetrics
      collectDefaultMetrics({ register })
    }

    _instance = new Context(register, metricsConfig)

    /* 启动监控 */
    const pc = new ProfileGateway(ctx, gatewayProfile.prefix, _instance)
    pc.run()

    // 监控事件
    ctx.emitter.on('recvReq', _instance.logRecvReq.bind(_instance))
    ctx.emitter.on('checkpointReq', _instance.logCheckpointReq.bind(_instance))
    ctx.emitter.on('proxyReq', _instance.logSendReq.bind(_instance))
    ctx.emitter.on('proxyRes', _instance.logResponse.bind(_instance))

    logger.info(`完成监控服务设置。`)

    return _instance
  }
})()