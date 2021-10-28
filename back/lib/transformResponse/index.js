const fs = require("fs")
const PATH = require("path")

class HttpTransformRes {
  constructor(config, transformInstanceMap) {
    this.config = config
    this.transformInstanceMap = transformInstanceMap
  }
  /**
   * 
   */
  getTargetTransform(targetRule) {
    let targetTransforms
    if (targetRule.transformResponse && Array.isArray(targetRule.transformResponse)) {
      targetTransforms = targetRule.transformResponse
    } else {
      targetTransforms = this.config.default
    }
    return targetTransforms
  }
  /**
   * 
   * @param {*} req 
   * @returns 
   */
  async check(req, disposeResponse) {
    const targetTransforms = this.getTargetTransform(req.targetRule)
    const resBody = await disposeResponse.getBody()
    const resStatusCode = await disposeResponse.statusCode
    const resHeaders = await disposeResponse.headers
    for (const t of targetTransforms) {
      const tarArf = this.transformInstanceMap.get(t)
      let func
      if (tarArf && typeof tarArf === "string") {
        const authPath = PATH.resolve(tarArf)
        if (fs.existsSync(authPath)) {
          func = require(authPath)
        }
      } else if (typeof tarArf === "function") {
        func = tarArf
      }
      if (typeof func === "function") {
        const rst = await func(req, resStatusCode, resHeaders, resBody)
        if (Object.prototype.toString.call(rst) !== '[object Object]') {
          return Promise.reject({msg: "请求拦截器 返回的不是一个object"})
        }
        
        if (rst.statusCode) disposeResponse.setStatusCode(parseInt(rst.statusCode))
        if (rst.headers) disposeResponse.setHeader(rst.headers)
        if (rst.body) disposeResponse.setBody(rst.body)
        
        return disposeResponse.end()
      }
    }
    return disposeResponse.end()
  }
}

module.exports = (function() {
  let instance
  return function(config) {
    if (instance) return instance

    const { enable, default: defaultTransform, ...transforms } = config

    let transformInstanceMap = new Map()
    for (const key in transforms) {
      const val = transforms[key]
      transformInstanceMap.set(key, val)
    }

    instance = new HttpTransformRes(config, transformInstanceMap)

    return instance
  }
})()
