/**
 * Ctrl返回结果
 */
 class ResultBase {
  constructor(result, msg, code) {
    this.msg = msg
    this.code = code
    if (result !== undefined && result !== null) this.result = result
  }
}
class ResultData extends ResultBase {
  constructor(result = null, msg = '正常', code = 0) {
    super(result, msg, code)
  }
}
/**
 * 一般错误
 * 前2位编码从10开始
 */
class ResultFault extends ResultBase {
  constructor(msg = '操作无法完成', code = 10001, result = null) {
    super(result, msg, code)
  }
}
class ResultObjectNotFound extends ResultFault {
  constructor(msg = '指定的对象不存在', result = null, code = 10002) {
    super(msg, code, result)
  }
}
/**
 * access_token失败
 * 前2位编码从20开始
 */
class AccessTokenFault extends ResultBase {
  constructor(msg = '', code = 20001, result = null) {
    super(result, msg, code)
  }
}

module.exports = {
  ResultData,
  ResultFault,
  ResultObjectNotFound,
  AccessTokenFault,
}
