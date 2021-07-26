const axios = require('axios')
const fs = require("fs")
const PATH = require("path")
const _ = require("lodash")

class HttpAuth {
  constructor(config, authInstanceMap) {
    this.config = config
    this.authInstanceMap = authInstanceMap
  }
  /**
   * 
   */
  getTargetAuth(targetRule) {
    let targetAuths
    if (targetRule.auth && Array.isArray(targetRule.auth)) {
      targetAuths = targetRule.auth
    } else {
      targetAuths = this.config.default
    }
    return targetAuths
  }
  /**
   * 
   * @param {*} req 
   * @param {*} res 
   * @returns 
   */
  async check(req, res) {
    //
    const targetAuths = this.getTargetAuth(req.targetRule)
    const { query } = require('url').parse(req.url, true)
    let errMsg = ""
    for (const t of targetAuths) {
      const tarAth = this.authInstanceMap.get(t)
      if (!tarAth.type) tarAth.type = "http"
      if (tarAth.type === "file") {
        const authPath = PATH.resolve(tarAth.path)
        if (fs.existsSync(authPath)) {
          const authFunc = require(authPath)
          if (typeof authFunc === "function") {
            const rst = await authFunc(req, res, tarAth)
            if (rst.code === 0) {
              return Promise.resolve({clientId: rst.clientId, clientLabel: rst.clientLabel, clientInfo: rst.clientInfo})
            } else {
              if (errMsg !== "") errMsg += " 或 "
              errMsg += rst.msg
            }
          } else return Promise.reject({msg: "指定的鉴权方式不是一个函数"})
        } else return Promise.reject({msg: "指定的鉴权方式不存在"})
      } else if (tarAth.type === "http") {
        let param = [tarAth.query[0], query[tarAth.query[1]]]
        param = param.join('=')
        const rst = await axios.get(`${tarAth.url}?${param}`)
        if (rst.data.code !== 0) {
          if (errMsg !== "") errMsg += " 或 "
          errMsg += rst.data.msg
        } else {
          const clientId = _.get(rst.data.result, tarAth.clientIdField, null)
          if (!clientId) {
            if (errMsg !== "") errMsg += " 或 "
            errMsg += `获取${tarAth.clientIdField}失败`
          } else {
            const clientLabel = _.get(rst.data.result, tarAth.clientLabelField, null)
            return Promise.resolve({clientId, clientLabel, clientInfo: rst.data.result})
          }
        }
      }
    }
    return Promise.reject({ msg: errMsg })
  }
}

module.exports = (function() {
  let instance
  return function(config) {
    if (instance) return instance

    const { enable, default: defaultAuth, ...auths } = config

    let authInstanceMap = new Map()
    for (const key in auths) {
      const val = auths[key]
      authInstanceMap.set(key, val)
    }

    instance = new HttpAuth(config, authInstanceMap)

    return instance
  }
})()
