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

    let returnData = {
      statusCode: resStatusCode, 
      headers: resHeaders, 
      body: resBody
    }
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
        await func(req, returnData)
        if (Object.prototype.toString.call(returnData) !== '[object Object]') {
          return Promise.reject({msg: "响应拦截器 返回的不是一个Object"})
        }
      }
    }

    if (returnData.statusCode) disposeResponse.setStatusCode(parseInt(returnData.statusCode))
    if (returnData.headers) disposeResponse.setHeader(returnData.headers)
    if (returnData.body) disposeResponse.setBody(returnData.body)
    
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
