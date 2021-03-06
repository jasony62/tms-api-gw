const axios = require('axios')
const adapter = require('axios/lib/adapters/http')
const log4js = require('log4js')

const { pushMessage: pushMsgConfig, name: appName } = require('../../config/gateway')
const RedisContext = require('../redis').Context

let log4jsConfig = {
  appenders: {
    consoleout: { type: 'console' }, 
  },
}
let appenders = ['consoleout']
if (pushMsgConfig.logPath) {
  log4jsConfig.appenders.logFile = {
    type: "file",
    filename: pushMsgConfig.logPath,
    maxLogSize: 10 * 1024 * 1024,
    numBackups: 10
  }
  appenders.push("logFile")
}
log4jsConfig.categories = {
  default: { appenders: appenders, level: 'debug' }
}
log4js.configure(log4jsConfig)
const logger = log4js.getLogger('tms-api-gw-sendMessage_send')

/**
 * 发送消息
 * @param {*} message 
 * @returns 
 */
async function sendMsg(message) {
  //
  message = JSON.parse(message)
  const { event, pushUrl, requestId, datas, headers: oHeaders = {} } = message
  if (!pushUrl) return [false, "未找到推送地址"]
  //
  const options = { 
    adapter,
    // timeout: 3000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  }
  const instance = axios.create(options)
  const headers = Object.assign({}, oHeaders)

  return instance
    .post(pushUrl, datas, { headers })
    .then( rst => {
      logger.info(requestId, event, " || ", JSON.stringify(datas) + JSON.stringify(headers), " || " + ' sendLog succes ', rst.status, rst.data)
      return [true]
    })
    .catch( err => {
      logger.error(requestId, event, " || ", JSON.stringify(datas) + JSON.stringify(headers), " || " + ' sendLog err ', err)
      return [false, requestId + " 消息发送失败 " + err.msg]
    })
}
/**
 * 初始化
 */
async function start() {
  /**
   * 连接redis
   */
  const { redis: redisConfig } = pushMsgConfig
  await RedisContext.init(redisConfig) 
  const RedisClint = await RedisContext.redisClient()
  /**
    * 订阅频道
    */
  RedisClint.subscribe(redisConfig.channel)
  //收到消息后执行回调，message是redis发布的消息
  RedisClint.on("message", async function (channel, message) {
    logger.debug("get message")
    const rst = await sendMsg(message)
    if (rst[0] === false) {
      logger.debug("发送消息失败：", rst[1])
    }
  })
  RedisClint.on("error", function (error) {
    logger.error("Redis Error ", error)
})
  //监听订阅成功事件
  RedisClint.on("subscribe", function (channel, count) {
      logger.info("客户端订阅消息频道 " + channel + ", " + count + " 条订阅")
  })
  //监听取消订阅事件
  RedisClint.on("unsubscribe", function (channel, count) {
      logger.info("客户端取消订阅消息频道" + channel + ", " + count + " 条订阅")
  })
}

start()

