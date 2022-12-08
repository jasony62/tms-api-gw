const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw-sendMessage')
const cp = require('child_process')
const _ = require('lodash')

/**
 * 启动新的进程
 *
*/
function startProcess() {
  logger.info('已完成框架初始化')
  //
  logger.info('开始启动消息发送线程……')
  let Replica_Child_Process = cp.spawn('node', ['./lib/pushMessage/send.js'], {
    // detached: true,
    // stdio: 'ignore',
  })
  // Replica_Child_Process.unref()
  Replica_Child_Process.stdout.setEncoding('utf8');
  Replica_Child_Process.stdout.on('data', function(data){
    logger.info(data);
  })
  Replica_Child_Process.stderr.setEncoding('utf8');
  Replica_Child_Process.stderr.on('data', function(data){
      logger.info(data);
  })
  Replica_Child_Process.on('exit', (code, signal) => {
    logger.info("消息发送线程退出", code, signal)
  })

  // 捕获ctrl+c
  process.on('SIGINT', () => {
    process.exit()
  })
  // 退出
  process.on('exit', () => {
    Replica_Child_Process.kill('SIGINT')
    logger.info('退出')
  })
}
/**
 * 初始化redis
 * @param {*} config 
 */
async function initReids(redisConfig) {
  const RedisContext = require('../redis').Context
  await RedisContext.init(redisConfig) 
  const RedisClint = await RedisContext.redisClient()

  return RedisClint
}

class MessageService {
  constructor(client, config) {
    this.client = client
    this.config = config
    this.redisConfig = config.redis
  }
  /**
   * 
   */
  async publish(message) {
    if (Object.prototype.toString.call(message) === '[object Object]') 
      message = JSON.stringify(message)

    return new Promise((resolve, reject) => {
      this.client.publish(
        this.redisConfig.channel,
        message,
        (err) => {
          if (err) {
            logger.error("redis publish error", err)
            return reject(err)
          } else {
            return resolve("ok")
          }
        }
      )
    })
  }
}

module.exports = async function(emitter, config) {
  let _instance
    if (_instance) return _instance
  //
  const redisConfig = config.redis
  const redisClint = await initReids(redisConfig)
  //
  _instance = new MessageService(redisClint, config)

  // 启动消息发送进程
  startProcess()
  
  return _instance
}