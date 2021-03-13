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
  logger.info('开始启动消息发送线程')
  let Replica_Child_Process = cp.spawn('node', ['./lib/sendMessage/send.js'], {
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
/**
 * 
 * @param {*} req 
 * @returns 
 */
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

class PublishMessage {
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
  /**
   * 记录请求的原始信息
   *
   * @param {*} req
   */
  sendLogRecvReq(req) {
    const { method, headers, url } = req
    const requestId = headers['x-request-id']
    const recvUrl = _.pick(require('url').parse(url, true), [
      'protocol',
      'hostname',
      'port',
      'pathname',
      'query'
    ])
    const datas = { requestId, recvUrl, method, recvHeaders: headers }
    this.publish({ 
      event: "recvReq", 
      requestId, 
      clientId: "", 
      datas 
    })
    return 
  }
  async sendLogSendReq(proxyReq, req, res, options) {
    const sendUrl = _.pick(options.target, [
      'protocol',
      'hostname',
      'port',
      'pathname'
    ])
    const requestId = req.headers['x-request-id']
    const clientId = req.headers['x-request-client']

    let recvBody
    if ('POST' == req.method) recvBody = await parseBody(req)
    const datas = { clientId, sendUrl, recvBody }
    this.publish({ 
      event: "sendReq", 
      requestId, 
      clientId, 
      datas 
    })
    return 
  }
  async sendLogResponse(proxyRes, req, res) {
    if (this.config.onlyError === true && proxyRes.statusCode === 200) {
      return
    }

    let body = []
    proxyRes.on('data', chunk => {
      body.push(chunk)
    })
    proxyRes.on('end', async () => {
      body = Buffer.concat(body).toString()
      const requestId = req.headers['x-request-id']
      const clientId = req.headers['x-request-client']
      const requestAt = req.headers['x-request-at']
      const elapseMs = new Date() * 1 - requestAt
      const { statusCode, statusMessage, headers } = proxyRes
      await this.publish({ 
        event: "response", 
        requestId, 
        clientId, 
        datas: {
          statusCode,
          statusMessage,
          responseHeaders: headers,
          responseBody: body,
          elapseMs
        }
      })
      res.end(body)
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
  _instance = new PublishMessage(redisClint, config)

  emitter.on('recvReq', _instance.sendLogRecvReq.bind(_instance))
  emitter.on('proxyReq', _instance.sendLogSendReq.bind(_instance))
  emitter.on('proxyRes', _instance.sendLogResponse.bind(_instance))

  // 启动消息发送进程
  startProcess()
  
  return _instance
}