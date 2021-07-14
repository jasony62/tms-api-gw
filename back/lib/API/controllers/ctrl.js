/**
 * 处理http请求的接口
 */
// http请求
const API_FIELD_REQUEST = Symbol('request')
// 发起调用的客户端
const API_FIELD_RESPONSE = Symbol('response')
//
const API_FIELD_MONGOOSE = Symbol('mongoose')
//
const API_FIELD_APPCONFIG = Symbol('appConfig')

class Ctrl {
  constructor(request, response, mongoose, appConfig) {
    this[API_FIELD_REQUEST] = request
    this[API_FIELD_RESPONSE] = response
    this[API_FIELD_MONGOOSE] = mongoose
    this[API_FIELD_APPCONFIG] = appConfig
  }

  get request() {
    return this[API_FIELD_REQUEST]
  }
  get response() {
    return this[API_FIELD_RESPONSE]
  }
  get mongoose() {
    return this[API_FIELD_MONGOOSE]
  }
  get appConfig() {
    return this[API_FIELD_APPCONFIG]
  }
  /**
   * 加载指定的model包，传递数据库实例
   *
   * @param {string} name 模型的名称（从models目录下开始）
   */
  model(name) {
    const path = `${process.cwd()}/lib/API/models/${name}`
    const Model = require(path)
    return (new Model(this.mongoose))
  }
  /**
   * 解决mongodb日期型数据时区问题
   *
   * @param {int} ts 时间戳
   */
  localDate(ts = Date.now()) {
    let d = new Date(ts)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d
  }
}

module.exports = Ctrl
