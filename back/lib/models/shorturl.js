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
  async deleteByUrl(url) {
    return this.shortMongoose.updateOne({target_url: url}, {$set: {state: 0}}).then( r => r )
  }
  /**
   * 
   */
  async byCode(code) {
    return this.shortMongoose.findOne({code, state: 1})
  }
}

module.exports = Shorturl