const fs = require("fs")
const PATH = require("path")

class HttpTransformReq {
  constructor(config, transformInstanceMap) {
    this.config = config
    this.transformInstanceMap = transformInstanceMap
  }
  /**
   * 
   */
  getTargetAuth(targetRule) {
    let targetTransforms
    if (targetRule.transformRequest && Array.isArray(targetRule.transformRequest)) {
      targetTransforms = targetRule.transformRequest
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
  async check(clientId, req) {
    const targetTransforms = this.getTargetAuth(req.targetRule)
    let returData = {}
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
        await func(clientId, req, returData)
        if (Object.prototype.toString.call(returData) !== '[object Object]') {
          return Promise.reject({msg: "请求拦截器 返回的不是一个object"})
        }
      }
    }
    return returData
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

    instance = new HttpTransformReq(config, transformInstanceMap)

    return instance
  }
})()
