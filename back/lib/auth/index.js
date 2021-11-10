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
    let errMsg = "权限错误: (10001)"
    let passData = {clientId: "", clientLabel: "", clientInfo: {}}
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
              passData = {clientId: rst.clientId, clientLabel: rst.clientLabel, clientInfo: rst.clientInfo}
            } else {
              if (rst.msg) errMsg = rst.msg
              return Promise.reject({ msg: errMsg })
            }
          } else return Promise.reject({msg: "配置错误：指定的鉴权方式不是一个函数"})
        } else return Promise.reject({msg: "配置错误：指定的鉴权方式不存在"})
      } else if (tarAth.type === "http") {
        let param = [tarAth.query[0], query[tarAth.query[1]]]
        param = param.join('=')
        const rst = await axios.get(`${tarAth.url}?${param}`)
        if (!rst.data || rst.data.code !== 0) {
          if (rst.data && rst.data.msg) errMsg = rst.data.msg
          return Promise.reject({ msg: errMsg })
        } else {
          const clientId = _.get(rst.data.result, tarAth.clientIdField, null)
          if (!clientId) {
            return Promise.reject({ msg: `权限错误：获取【${tarAth.clientIdField}】失败(1002)` })
          } else {
            const clientLabel = _.get(rst.data.result, tarAth.clientLabelField, null)
            passData = {clientId, clientLabel, clientInfo: rst.data.result}
          }
        }
      } else {
        return Promise.reject({ msg: "配置错误：未识别的鉴权类型" })
      }
      // 检查用户ip
      if (tarAth.whiteListIPFIELD) {
        let whiteListIPs = _.get(passData.clientInfo, tarAth.whiteListIPFIELD, [])
        if (whiteListIPs && whiteListIPs.length > 0) {
          if (typeof whiteListIPs === "string") {
            whiteListIPs = whiteListIPs.split(",")
          } else if (Array.isArray(whiteListIPs)) {
            whiteListIPs = whiteListIPs
          } else {
            return Promise.reject({ msg: "配置错误：不支持的IP白名单格式" })
          }

          if (
            !whiteListIPs.some( wip => {
              const re = new RegExp(wip)
              return re.test(req.headers["x-request-ip"])
            })
          ) {
            return Promise.reject({ msg: "权限错误：无权访问(1003)" })
          }
        }
      }
    }
    return Promise.resolve(passData)
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
