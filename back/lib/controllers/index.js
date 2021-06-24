const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw-controller')
const _ = require("lodash")
const fs = require("fs")
const { ResultFault, ResultObjectNotFound } = require('./response')

/**
 * 
 */
class Wrapper {
  constructor(context, config) {
    this.context = context
    this.config = config
  }
  /**
   * 
   * @param {*} ctrlName 
   * @param {*} path 
   * @returns 
   */
  findCtrlClassInControllers(ctrlName, path) {
    // 从控制器路径查找
    let ctrlPath = process.cwd() + `/lib/controllers/${ctrlName}.js`
    if (!fs.existsSync(ctrlPath)) {
      ctrlPath = process.cwd() + `/lib/controllers/${ctrlName}/main.js`
      if (!fs.existsSync(ctrlPath)) {
        let logMsg = `参数错误，请求的控制器不存在(2)`
        logger.isDebugEnabled()
          ? logger.debug(logMsg, path, ctrlPath)
          : logger.error(logMsg)
        throw new Error(logMsg)
      }
    }
  
    const CtrlClass = require(ctrlPath)
  
    return CtrlClass
  }
  /**
   * @param {*} request 
   * @returns 
   */
  findCtrlClassAndMethodName(request) {
    const prefix = _.get(this.config, "router.controllers.prefix", "")
    let { path } = request
    if (prefix) {
      if (path.indexOf(prefix) !== 0) {
        let logMsg = '参数错误，请求的控制器不存在(1)'
        logger.isDebugEnabled()
          ? logger.debug(logMsg, path)
          : logger.error(logMsg)
        throw new Error(logMsg)
      }
      path = path.replace(prefix, '')
    }
  
    let pieces = path.split('/').filter((p) => p)
    if (pieces.length === 0) {
      let logMsg = '参数错误，请求的控制器不存在(1)'
      logger.isDebugEnabled()
        ? logger.debug(logMsg, path, pieces)
        : logger.error(logMsg)
      throw new Error(logMsg)
    }
    let CtrlClass
    const method = pieces.splice(-1, 1)[0]
    const ctrlName = pieces.length ? pieces.join('/') : 'main'
    // 从控制器路径查找
    CtrlClass = this.findCtrlClassInControllers(ctrlName, path)
  
    return [ctrlName, CtrlClass, method]
  }
  /**
   * 根据请求找到对应的控制器并执行
   */
  async fnCtrl(request, response) {
    /* 只处理api请求，其它返回找不到 */
    if (/\./.test(request.path)) {
      response.statusCode = 404
      response.setHeader("Content-Type", "text/plain;charset=utf-8")
      return (response.body = 'Not Found')
    }
    /* 查找控制器和方法 */
    let findCtrlResult
    try {
      findCtrlResult = this.findCtrlClassAndMethodName(request)
    } catch (e) {
      let logMsg = e.message || `无法识别指定的请求，请检查输入的路径是否正确`
      logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.error(logMsg)
      return (response.body = new ResultFault(logMsg))
    }
    const [ctrlName, CtrlClass, method] = findCtrlResult

    /* 数据库连接 */
    let mongooseWrapper
    try {
      const { MongooseContextCtrl } = this.context
      if (MongooseContextCtrl) {
        mongooseWrapper = MongooseContextCtrl
      }
      /**
       * 创建控制器实例
       */
      const oCtrl = new CtrlClass(
        request, 
        response,
        mongooseWrapper,
        this.config
      )
      /**
       * 检查指定的方法是否存在
       */
      if (oCtrl[method] === undefined && typeof oCtrl[method] !== 'function') {
        let logMsg = '参数错误，请求的控制器不存在(3)'
        logger.isDebugEnabled()
          ? logger.debug(logMsg, oCtrl)
          : logger.error(logMsg)
        return (response.body = new ResultFault(logMsg))
      }
      /**
       * 前置操作
       */
      if (oCtrl.tmsBeforeEach && typeof oCtrl.tmsBeforeEach === 'function') {
        const resultBefore = await oCtrl.tmsBeforeEach(method)
        if (resultBefore instanceof ResultFault) {
          return (response.body = resultBefore)
        }
      }
      /* 执行方法调用 */
      const result = await oCtrl[method]()

      response.body = result
      return
    } catch (err) {
      logger.error('控制器执行异常', err)
      let errMsg =
        typeof err === 'string' ? err : err.message ? err.message : err.toString()
      response.body = new ResultFault(errMsg)
      return 
    }
  }
  /**
   * 短链接 根据短链接获取真实链接
   */
  async shorturl_decode(shortUrl, wrapper) {
    const { decode } = require(process.cwd() + `/lib/controllers/shorturl/main`)
    return decode(shortUrl, this.context.MongooseContextCtrl, this.config)
  }
}

/**
 * 实例化数据库 auth, trace, quota, transformRequest
 */
function getMongodbModel(mongoose) {
  const short_url = new mongoose.Schema(
    {
      clientId: String,
      code: String,
      state: { type: Number, default: 1 },
      target_title: String,
      target_url: String,
      auth: Array,
      trace: Array,
      quota: Array,
      transformRequest: Array,
      createAt: { type: Date },
      count: { type: Number, default: 0 }
    },
    { collection: 'short_url' }
  )

  const shorturlSchema = mongoose.model('short_url', short_url)

  return { shorturlSchema }
}

module.exports = async function(ctx, config) {
  //
  let context = {}
  if (config.mongodb) {
    const MongoContext = require('../mongo')
    const mongo = await MongoContext.ins(config.mongodb)
    context.MongooseContextCtrl = getMongodbModel(mongo.mongoose)
  }
  const wrapper = new Wrapper(context, config)
  
  return wrapper
}