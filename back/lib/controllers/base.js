const { ResultData, ResultFault, ResultObjectNotFound } = require('./response')
const Ctrl = require('./ctrl')

class Base extends Ctrl {
  constructor(...args) {
    super(...args)
  }
}

module.exports = Base