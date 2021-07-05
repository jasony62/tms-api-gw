const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw_mgo')

class MongoError extends Error {
  constructor(msg) {
    super(msg)
  }
}
/**
 * mongodb配置
 */
class MongoContext {
  constructor(mongoose) {
    this.mongoose = mongoose
  }
}
MongoContext.connect = function(url) {
  const mongoose = require('mongoose')

  return mongoose
    .connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => {
      mongoose.connection.on('error', err => {
        const msg = `mongodb操作错误：${err.message}`
        logger.error(msg)
        throw new MongoError(msg)
      })

      logger.info(`连接'${url}'成功`)
      return mongoose
    })
    .catch(err => {
      const msg = `连接'${url}'失败：${err.message}`
      logger.error(msg)
      return Promise.reject(new MongoError(msg))
    })
}
MongoContext.ins = (function() {
  let _instances = new Map()
  return async function({ user, password, host, port, database, maxPoolSize }) {
    if (typeof host !== 'string') {
      let msg = '没有指定mongodb的主机地址'
      logger.error(msg)
      throw new MongoError(msg)
    }
    if (typeof port !== 'number') {
      let msg = '没有指定mongodb连接的端口'
      logger.error(msg)
      throw new MongoError(msg)
    }
    if (typeof database !== 'string') {
      let msg = '没有指定mongodb连接的数据库'
      logger.error(msg)
      throw new MongoError(msg)
    }

    let url
    maxPoolSize = +maxPoolSize
    if (user && typeof user === "string" && password && typeof password === "string") {
      url = `mongodb://${user}:${password}@${host}:${port}/${database}?authSource=admin`
      if (maxPoolSize > 5) url += `&maxPoolSize=${maxPoolSize}` 
    } else {
      url = `mongodb://${host}:${port}/${database}`
      if (maxPoolSize > 5) url += `?maxPoolSize=${maxPoolSize}` 
    }

    if (_instances.has(url)) return _instances.get(url)

    logger.debug('开始连接 %s', url)
    const mongoose = await MongoContext.connect(url)
    logger.debug('完成连接 %s', url)

    const instance = new MongoContext(mongoose)

    _instances.set(url, instance)

    return instance
  }
})()

module.exports = MongoContext
