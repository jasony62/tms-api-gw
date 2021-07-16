const { customAlphabet } = require('nanoid')

class Base {
  constructor(mongoose) {
    this.mongoose = mongoose
  }
  /**
   * 生成随机数
   */
  gen_nanoid(length = 5, source = "123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const nanoid = customAlphabet(source, length)
    return nanoid()
  }
}

module.exports = Base