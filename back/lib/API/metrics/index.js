const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw-metrics')

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

    logger.info(`完成监控服务设置。`)

    return _instance
  }
})()