const axios = require('axios')
const fs = require("fs")
const PATH = require("path")

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
    for (const tarAth of targetAuths) {
      if (tarAth.type === "file") {
        const authPath = PATH.resolve(tarAth.path)
        if (fs.existsSync(authPath)) {
          const authFunc = require(authPath)
          if (typeof authFunc === "function") {
            const rst = await authFunc(req, res)
            if (rst.code === 0) {
              return Promise.resolve(rst.data.clientId)
            } else {
              if (errMsg !== "") errMsg += " 或 "
              errMsg += rst.msg
            }
          } else return Promise.reject({msg: "指定的鉴权方式不是一个promise方法"})
        } else return Promise.reject({msg: "指定的鉴权方法不存在"})
      } else if (tarAth.type === "http") {
        let param = [tarAth.query[0], query[tarAth.query[1]]]
        param = param.join('=')
        console.log(2.1111)
        const rsp = await axios.get(`${tarAth.url}?${param}`)
        console.log(2.2222, rsp)
        console.log(2.3333)
        if (rsp.data.code !== 0) {
          if (errMsg !== "") errMsg += " 或 "
          errMsg += rst.msg
        } else {
          const client = rsp.data.result
          const clientId = client[tarAth.clientIdField]
          return Promise.resolve(clientId)
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
