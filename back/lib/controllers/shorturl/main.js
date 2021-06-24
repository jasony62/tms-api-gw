const Base = require('../base')

class Main extends Base {
  constructor(...args) {
    super(...args)
  }
  /**
   * 
   */
  async encode() {
    if (this.request.method !== "POST") return new ResultFault("request method != post")

    const { url, auth, trace, quota, transformRequest, title } = this.request.body
    
    const Model = this.model("/shorturl")
    let rst = await Model.byUrl(url)
    if (!rst) {
      rst = await Model.add(url, { auth, trace, quota, transformRequest, target_title: title })
    }

    return {
      short_url: `${this.appConfig.shorturl.host}${this.appConfig.shorturl.prefix}/${rst.code}`,
      url: rst.target_url,
      title: rst.title,
      create_at: rst.createAt
    }
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

  return { 
    target_url: shortData.target_url, 
    auth: shortData.auth, 
    trace: shortData.trace, 
    quota: shortData.quota,
    transformRequest: shortData.transformRequest, 
  }
}

module.exports = Main