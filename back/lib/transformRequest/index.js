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
   * @param {*} target 
   * @returns 
   */
  async check(clientId, req, target, redundancyOptions) {
    const targetTransforms = this.getTargetAuth(req.targetRule)
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
        const rst = await func(clientId, req, target, redundancyOptions)
        return {
          target: rst.target || "",
          headers: rst.headers || "",
        }
      }
    }
    return {}
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
