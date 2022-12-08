const Base = require('./base')

class Shorturl extends Base {
  constructor(...args) {
    super(...args)
    this.shortMongoose = this.mongoose.shorturlSchema
  }
  /**
   * 
   */
  async byUrl(url) {
    return this.shortMongoose.findOne({target_url: url, state: 1})
  }
  /**
   * 
   */
  async add(targetUrl, options = {}) {
    const code = this.gen_nanoid()

		const findCodeRst = await this.byCode(code, "N")
    if (findCodeRst) {
      await this.add(targetUrl, options = {})
    }
    //
    const { auth, trace, quota, transformRequest, target_title, expiration } = options
    let insData = {
      clientId: "",
      code,
      target_title,
      target_url: targetUrl,
      createAt: new Date(),
      auth, 
      trace, 
      quota, 
      transformRequest
    }
    if (expiration > 0) {
      insData.expiration = Date.now() + (expiration * 1000)
    }

    return this.shortMongoose.create(insData).then( r => r )
  }
  /**
   * 
   */
  async deleteByUrl(url) {
    return this.shortMongoose.updateOne({target_url: url, state: 1}, {$set: {state: 0}}).then( r => r )
  }
  /**
   * 
   */
  async byCode(code, single = "Y") {
    let where = { code }
    if (single === "Y") {
      where.state = 1
    }

    return this.shortMongoose.findOne(where)
  }
  /**
   * 
   */
  async updateById(id, upData) {
    let data = {}

    if (![undefined].includes(upData.target_title)) data.target_title = upData.target_title
    if (![undefined].includes(upData.auth)) data.auth = upData.auth
    if (![undefined].includes(upData.trace)) data.trace = upData.trace
    if (![undefined].includes(upData.quota)) data.quota = upData.quota
    if (![undefined].includes(upData.transformRequest)) data.transformRequest = upData.transformRequest
    if (![undefined].includes(upData.expiration)) {
      if (upData.expiration > 0) {
        data.expiration = Date.now() + (upData.expiration * 1000)
      }
    }

    if (Object.keys(data).length == 0) {
      return data
    }

    data.updateAt = new Date()

    return this.shortMongoose.updateOne({_id: id}, {$set: data}).then( r => data )
  }
}

module.exports = Shorturl