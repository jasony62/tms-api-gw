const Base = require('../base')

class Index extends Base {
  constructor(...args) {
    super(...args)
  }
  /**
   * 
   */
  async encode() {

  }
}
/**
 * 
 * @param {*} shortUrl 
 * @param {*} mongooseContext 
 * return {target: 'http://127.0.0.1:3533/etd/api/dev189',auth: [ 'httpYz' ],trace: [ 'mongodb', 'http' ],quota: [ 'rule_test' ] ,……}
 * */
Index.decode = async (shortUrl, mongooseContext) => {
  return {target: 'http://127.0.0.1:3533/etd/api/dev189/bininsert',auth: [ 'httpYz' ],trace: [ 'mongodb', 'http' ],quota: [ 'rule_test' ]}
}

module.exports = Index