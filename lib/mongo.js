const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')

class MongoError extends Error {
  constructor(msg) {
    super(msg)
  }
}
/**
 * mongodb配置
 */
class MongoContext {}
MongoContext.connect = function(host, port, database) {
  const mongoose = require('mongoose')
  const url = `mongodb://${host}:${port}/${database}`

  mongoose.connection.on('error', function(err) {
    const msg = `mongodb操作错误：${err.message}`
    logger.error(msg, err)
    throw new MongoError(msg)
  })

  return mongoose
    .connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => {
      logger.info(`连接'${url}'成功`)
      return mongoose
    })
    .catch(err => {
      const msg = `连接'${url}'失败：${err.message}`
      logger.error(msg, err)
      return Promise.reject(new MongoError(msg))
    })
}
MongoContext.ins = (function() {
  let instance
  return async function({ host, port, database }) {
    if (instance) return instance

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

    const mongoose = await MongoContext.connect(host, port, database)

    return (instance = Object.assign(new MongoContext(), {
      host,
      port,
      database,
      mongoose
    }))
  }
})()

module.exports = MongoContext
