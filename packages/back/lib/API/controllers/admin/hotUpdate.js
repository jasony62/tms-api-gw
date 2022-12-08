const Base = require('../base')
const { ResultFault, ResultData } = require('../response')

class Main extends Base {
  constructor(...args) {
    super(...args)
  }
  
  async config() {
    const { Context} = require("../../../context")
    let appContext = await Context.ins()

    appContext = await Context.hotUpdate()

    return new ResultData("更新成功")
  }
}

module.exports = Main