const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-redis')
const redis = require('redis')

class Context {
  constructor(redisClient) {
    this.redisClient = redisClient
  }
}
Context.connect = function (url) {
  return new Promise((resolve, reject) => {
    const client = redis.createClient(url)
    client.on('ready', () => {
      resolve(client)
    })
    client.on('error', (err) => {
      logger.warn(`连接Redis失败：${err.message}`)
      client.end(true)
      reject(err)
    })
  })
}
Context.ins = (function () {
  let _instancesByUrl = new Map()
  let _instancesByName = new Map()
  /**
   *
   */
  return async function (config, name) {
    if (typeof config === 'string' && undefined === name) {
      return _instancesByName.get(config)
    }

    let { host, port, password } = config || {}
    if (
      undefined === host &&
      undefined === port &&
      _instancesByUrl.size === 1
    ) {
      return _instancesByUrl.values().next().value
    }
    if (typeof host !== 'string') {
      let msg = '没有指定Redis的主机地址'
      logger.error(msg)
      throw new redis.RedisError(msg)
    }
    if (typeof port !== 'number') {
      let msg = '没有指定Redis连接的端口'
      logger.error(msg)
      throw new redis.RedisError(msg)
    }

    let url = `redis://${host}:${port}`
    if (password) url += `?password=${password}`

    if (_instancesByUrl.has(url)) return _instancesByUrl.get(url)

    logger.debug('开始连接[%s]', url)
    const client = await Context.connect(url)
    logger.debug('完成连接[%s]', url)

    const instance = new Context(client)

    _instancesByUrl.set(url, instance)
    _instancesByName.set(name, instance)

    return instance
  }
})()
/**
 * 按照配置文件进行初始化
 */
Context.init = async function (config) {
  if (!config || typeof config !== 'object') {
    let msg = '没有指定连接redis配置信息'
    logger.error(msg)
    throw new redis.RedisError(msg)
  }

  if (config.diabled === true) {
    return {}
  }

  const names = Object.keys(config).filter((n) => n !== 'disabled')
  if (names.length === 0) {
    let msg = '指定连接redis配置信息为空'
    logger.error(msg)
    throw new redis.RedisError(msg)
  }

  let instances
  if (names.includes('host') && names.includes('port')) {
    instances = [await Context.ins(config, 'master')]
  } else {
    instances = await Promise.all(
      names.map((name) => Context.ins(config[name], name))
    )
  }

  return instances
}

/**
 *
 */
Context.redisClient = async function (name = 'master', duplicate = false) {
  const ins = await Context.ins(name)
  if (!ins) throw new Error(`无法获得redis[${name}]连接实例`)
  if (duplicate === true) return ins.redisClient.duplicate()
  return ins.redisClient
}

module.exports = { Context }
