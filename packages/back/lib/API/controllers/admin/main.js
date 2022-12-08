const Base = require('../base')
const { ResultFault, ResultData } = require('../response')

class Main extends Base {
  constructor(...args) {
    super(...args)
  }
  
  async getConfig() {
    const { Context} = require("../../../context")
    const appContext = await Context.ins()
    
    return new ResultData(appContext.config)
  }
}

module.exports = Main