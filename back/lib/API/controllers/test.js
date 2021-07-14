const Base = require('./base')
const { ResultData } = require('./response')

class Test extends Base {
  constructor(...args) {
    super(...args)
  }

  test() {
    return new ResultData("testtest")
  }
}

module.exports = Test