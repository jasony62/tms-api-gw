const { isNull } = require('lodash')
const Base = require('../base')
const { ResultFault, ResultData } = require('../response')

class Main extends Base {
  constructor(...args) {
    super(...args)
  }
  /**
   * 检查参数格式
   */
  checkParams(params) {
    let newParams = {}
    for (const key in params) {
      const val = params[key]
      if (["auth", "trace", "quota", "transformRequest"].includes(key)) {
        if (["", null].includes(val)) {
          newParams[key] = null
        } else if (Array.isArray(val)) {
          newParams[key] = val
        } else {
          return [false, `参数 ${key} 格式错误`]
        }
      } else if (key === "url") {
        if (!this.checkUrl(val)) {
          return [false, "目标地址格式错误"]
        } else {
          newParams[key] = val
        }
      } else if (key === "title") {
        newParams[key] = val
      } else if (key === "expiration") {
        if (isNaN(val) || ~~val < 1) {
          return [false, `参数 ${key} 格式错误`]
        }
        newParams[key] = ~~val
      }
    }

    return [true, newParams]
  }
  /**
   * 检查url
   */
  checkUrl(url) {
    try {
      new URL(url)
    } catch (err) {
      return false
    }

    return true
  }
  /**
   * 
   */
  async encode() {
    if (this.request.method !== "POST") return new ResultFault("request method != post")

    const addData = this.checkParams(this.request.body)
    if (addData[0] === false) {
      return new ResultFault(addData[1])
    }
    const { url, auth = null, trace = null, quota = null, transformRequest = null, title = "", expiration = 0 } = addData[1]
    if (!url) {
      return new ResultFault("目标地址格式错误")
    }
    
    const Model = this.model("/shorturl")
    let rst = await Model.byUrl(url)
    if (!rst) {
      rst = await Model.add(url, { auth, trace, quota, transformRequest, target_title: title, expiration })
    }

    return new ResultData({
      short_url: `${this.appConfig.shorturl.host}${this.appConfig.shorturl.prefix}/${rst.code}`,
      short_url_code: rst.code,
      url: rst.target_url,
      auth: rst.auth,
      trace: rst.trace,
      quota: rst.quota,
      transformRequest: rst.transformRequest,
      title: rst.title,
      create_at: rst.createAt,
      expiration: rst.expiration
    })
  }
  /**
   * 
   */
  async updateByUrl() {
    if (this.request.method !== "POST") return new ResultFault("request method != post")

    let upData = this.checkParams(this.request.body)
    if (upData[0] === false) {
      return new ResultFault(upData[1])
    }
    upData = upData[1]
    if (!upData.url) {
      return new ResultFault("目标地址格式错误")
    }

    const Model = this.model("/shorturl")
    let sUrl = await Model.byUrl(upData.url)
    if (!sUrl) {
      return new ResultFault("指定的地址不存在")
    }

    upData.target_title = upData.title
    delete upData.url
    delete upData.title
    const upRst = await Model.updateById(sUrl._id, upData)
    
    sUrl = JSON.parse(JSON.stringify(sUrl))
    delete sUrl._id
    delete sUrl.__v

    return new ResultData(Object.assign({}, sUrl, upRst))
  }
  /**
   * 
   */
   async deleteByUrl() {
    if (this.request.method !== "POST") return new ResultFault("request method != post")

    const upData = this.checkParams(this.request.body)
    if (upData[0] === false) {
      return new ResultFault(upData[1])
    }
    const { url } = upData[1]
    if (!url) {
      return new ResultFault("目标地址格式错误")
    }

    const Model = this.model("/shorturl")
    let rst = await Model.byUrl(url)
    if (!rst) {
      return new ResultFault("指定的地址不存在")
    }

    await Model.deleteByUrl(url)
    
    return new ResultData("成功")
  }
}
/**
 * 
 * @param {*} shortUrl 
 * @param {*} MongooseContextCtrl 
 * return {target: 'http://127.0.0.1:3533/etd/api/dev189',auth: [ 'httpYz' ],trace: [ 'mongodb', 'http' ],quota: [ 'rule_test' ] ,……}
 * */
Main.decode = async (shortUrl, MongooseContextCtrl, appConfig) => {
  const shortModel = require("../../models/shorturl")

  const code = shortUrl.replace(`${appConfig.shorturl.prefix}/`, "")
  const model = new shortModel(MongooseContextCtrl)
  const shortData = await model.byCode(code)
  if (!shortData) {
    return null
  }
  if (shortData.expiration) {
    if (shortData.expiration < Date.now()) {
      model.deleteByUrl(shortData.target_url)
      return null
    }
  }

  return { 
    target_url: shortData.target_url, 
    auth: shortData.auth, 
    trace: shortData.trace, 
    quota: shortData.quota,
    transformRequest: shortData.transformRequest, 
  }
}

module.exports = Main