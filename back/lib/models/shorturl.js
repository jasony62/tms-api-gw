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
    return this.shortMongoose.findOne({target_url: url})
  }
  /**
   * 
   */
  async add(targetUrl, options = {}) {
    const code = this.gen_nanoid()

		const findCodeRst = await this.byCode(code)
    if (findCodeRst) {
      await this.add(targetUrl, options = {})
    }
    //
    const { auth, trace, quota, transformRequest, target_title } = options
    const insData = {
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
    return this.shortMongoose.create(insData).then( r => r )
  }
  /**
   * 
   */
  async byCode(code) {
    return this.shortMongoose.findOne({code})
  }
}

module.exports = Shorturl