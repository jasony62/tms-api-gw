/**
 * mongodb配置
 */
class MongoConfig {}
MongoConfig.connect = function(host, port, database) {
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
MongoConfig.ins = (function() {
  let instance
  return async function() {
    if (instance) return instance
    const filename = path.resolve('config/mongodb.js')
    if (!fs.existsSync(filename)) {
      const msg = `配置文件${filename}不存在`
      logger.error(msg)
      return new MongoError(msg)
    }

    const { host, port, database } = require(filename)

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

    const mongoose = await MongoConfig.connect(host, port, database)

    logger.info(`加载配置文件'${filename}'成功`)

    return (instance = Object.assign(new MongoConfig(), {
      host,
      port,
      database,
      mongoose
    }))
  }
})()
