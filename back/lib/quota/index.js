const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')
const _ = require("lodash")
const fs = require("fs")
const PATH = require("path")
const cronParser = require('cron-parser')
const axios = require('axios')
const adapter = require('axios/lib/adapters/http')

class Quota {
  constructor(ModelDay, ModelArchive, quotaRulesMap, defaultQuota) {
    this.modelDay = ModelDay
    this.modelArchive = ModelArchive
    this.quotaRulesMap = quotaRulesMap
    this.defaultQuota = defaultQuota
  }
  /**
   *
   * @param {*} req
   */
  getReqInfo(req) {
    const clientId = req.headers['x-request-client']
    const api = req.originUrlObj.pathname
    const requestAt = req.headers['x-request-at']
    const targetRule = req.targetRule

    return { clientId, api, requestAt, targetRule }
  }
  /**
   *  
   */
  _getReqQuotaRule(targetRule) {
    let getReqTargetRules
    if (targetRule.quota && Array.isArray(targetRule.quota)) {
      getReqTargetRules = targetRule.quota
    } else {
      getReqTargetRules = this.defaultQuota
    }
    return getReqTargetRules
  }
  /**
   *  
   */
  async _getItemRule(req, quotaConfig, quotaName) {
    if (req['gw_quota'] && req['gw_quota'][quotaName]) {
      return req['gw_quota'][quotaName]
    }

    const { clientId, api } = this.getReqInfo(req)

    if (typeof quotaConfig === "string") {
      quotaConfig = {
        type: "file",
        path: quotaConfig
      }
    }
    if (Object.prototype.toString.call(quotaConfig) !== "[object Object]") {
      return Promise.reject({msg: `解析错误：控制规则不是一个object`})
    }
    
    let itemId = null, rateLimit = null, attachedField = null
    if (quotaConfig.type === "object") {
      if (quotaConfig.item) {
        let items = []
        attachedField = {}
        for (const itemKey in quotaConfig.item) {
          const val = _.get(req, quotaConfig["item"][itemKey], "")
          attachedField[itemKey] = val
          items.push(val)
        }
        itemId = items.join(":")
      }
      if (quotaConfig.rateLimit) rateLimit = quotaConfig.rateLimit
    } else if (quotaConfig.type === "http") {
      let postBody = {}
      for (const key in quotaConfig.parameter) {
        postBody[key] = _.get(req, quotaConfig.parameter[key])
      }
      let options = { adapter }
      options.timeout = quotaConfig.timeout || 1000
      options.maxBodyLength = Infinity
      options.maxContentLength = Infinity
      const instance = axios.create(options)
      await instance
        .post(`${quotaConfig.url}`, postBody)
        .then( res => {
          if (!res.data || res.data.code !== 0) {
            let errMsg = "返回异常"
            if (res.data && res.data.msg) errMsg = res.data.msg
            return Promise.reject({ msg: errMsg })
          }
          const item = res.data
          itemId = _.get(item, quotaConfig.itemIdField, null)
          rateLimit = _.get(item, quotaConfig.rateLimitField, null)
          attachedField = _.get(item, quotaConfig.attachedField, null)
        })
        .catch( err => {
          let msg = err.msg ? err.msg : err.toString()
          logger.debug("quota item", req.headers['x-request-id'], err)
          return Promise.reject({ msg })
        })
    } else if (quotaConfig.type === "file") { // {itemId:****,rateLimit:****}
      const quoPath = PATH.resolve(quotaConfig.path)
      if (fs.existsSync(quoPath)) {
        const rst = require(quoPath)(req)
        itemId = rst.itemId
        if (rst.rateLimit) rateLimit = rst.rateLimit
        if (rst.attachedField) attachedField = rst.attachedField
      }
    }

    if (!itemId) { // 默认值
      itemId = `${clientId}:${api}`
    }
    if (!attachedField) { // 默认值
      attachedField = { clientId, api }
    }
  
    const returnData = { id: itemId, rateLimit, attachedField }
    // 避免重复请求
    if (req.gw_quota) {
      req['gw_quota'][quotaName] = returnData
    } else {
      req['gw_quota'] = {}
      req['gw_quota'][quotaName] = returnData
    }

    return returnData
  }
  /**
   * 记录当天数据
   *
   * @param {*} proxyRes
   * @param {*} req
   * @param {*} res
   */
  async logDay(proxyRes, req, res) {
    const { clientId, api, requestAt, targetRule } = this.getReqInfo(req)
    const quotaRules = this._getReqQuotaRule(targetRule)
    for (const quotaRule of quotaRules) {
      const quotaConfig = this.quotaRulesMap.get(quotaRule)
       // 获取分类id
      const item = await this._getItemRule(req, quotaConfig, quotaRule)
      if (!item.rateLimit) {
        continue
      }
      
      const itemId = item.id
      const rateLimit = item.rateLimit
      if (!rateLimit.rate) {
        return Promise.reject({msg: `配额统计规则配置错误`})
      }

      // 获取下一个时间节点
      const interval = cronParser.parseExpression(rateLimit.rate)
      const rateNextTime = interval.next().getTime()

      const doc = await this.modelDay.findOne({ itemId })
      if (doc) {
        if (rateNextTime === doc.rateNextTime) {
          await doc.updateOne({ $set: { latestAt: requestAt }, $inc: { count: 1 } })
        } else {
          await doc.updateOne({ $set: { latestAt: requestAt, rateNextTime, count: 1 } })
        }
      } else {
        await this.modelDay.create({
          itemId,
          latestAt: requestAt,
          rateNextTime,
          rateLimit,
          count: 1
        })
      }

    }
  }
  /**
   * 记录归档数据
   *
   * @param {*} proxyRes
   * @param {*} req
   * @param {*} res
   */
  async logArchive(proxyRes, req, res) {
    const { requestAt, targetRule } = this.getReqInfo(req)
    const quotaRules = this._getReqQuotaRule(targetRule)

    for (const quotaRule of quotaRules) {
      const quotaConfig = this.quotaRulesMap.get(quotaRule)
       // 获取分类id
      const item = await this._getItemRule(req, quotaConfig, quotaRule)
      const itemId = item.id
      const attachedField = item.attachedField

      const oRequestAt = new Date(requestAt)
      const year = oRequestAt.getFullYear()
      const month = oRequestAt.getMonth() + 1
      const day = oRequestAt.getDate()

      await this.modelArchive.updateOne(
        { itemId, year, month, day },
        { $set: { latestAt: requestAt, attachedField }, $inc: { count: 1 } },
        { upsert: true }
      )
    }
  }
  /**
   * 检查配额，如果不满足抛出异常
   *
   * @param {*} req
   */
  async check(req) {
    const { clientId, api, requestAt, targetRule } = this.getReqInfo(req)
    const reqQuotaRules = this._getReqQuotaRule(targetRule)

    for (const reqQuoRul of reqQuotaRules) {
      const quoConfig = this.quotaRulesMap.get(reqQuoRul)

      const { id: itemId, rateLimit } = await this._getItemRule(req, quoConfig, reqQuoRul)

      let limit = _.get(rateLimit, "limit", 0)
      limit = +limit
      if (limit < 1) continue

      const doc = await this.modelDay.findOne({ itemId })
      if (doc) {
        if (requestAt < doc.rateNextTime) {
          if (doc.count >= limit) {
            logger.warn(`quota check minuLimit || ${req.headers['x-request-id']} || ${req.originUrl} || ${new Date() * 1 - req.headers['x-request-at']}`, `API 执行流量控制, 限制次数为[${limit}], 周期[${rateLimit.rate}], 请在【${doc.rateNextTime - requestAt}ms】后再次尝试`)
            return Promise.reject({msg: `API 执行流量控制, 限制次数为[${limit}], 周期[${rateLimit.rate}], 请在【${doc.rateNextTime - requestAt}ms】后再次尝试`})
          }
        }
      }
    }

    return Promise.resolve(true)
  }
}

Quota.createModelDay = function(mongoose) {
  const schema = new mongoose.Schema(
    {
      itemId: String,
      count: Number,
      latestAt: Number,
      rateNextTime: Number,
      rateLimit: { type: Object, default: {} }
    },
    { collection: 'counter_day' }
  )

  const Model = mongoose.model('counter_day', schema)

  return Model
}
Quota.createModelArchive = function(mongoose) {
  const schema = new mongoose.Schema(
    {
      itemId: String,
      attachedField: { type: Object, default: {} },
      latestAt: Number,
      year: Number,
      month: Number,
      day: Number,
      count: Number
    },
    { collection: 'counter_archive' }
  )

  const Model = mongoose.model('counter_archive', schema)

  return Model
}

module.exports = (function() {
  let _instance
  return function(emitter, mongoose, config) {
    if (_instance) return _instance

    const { default: defaultQuota, enable, mongodb, ...rules } = config
    let ModelDay = Quota.createModelDay(mongoose)
    let ModelArchive = Quota.createModelArchive(mongoose)

    let quotaRulesMap = new Map()
    for (const rl in rules) {
      quotaRulesMap.set(rl, rules[rl])
    }

    _instance = new Quota(ModelDay, ModelArchive, quotaRulesMap, defaultQuota)

    emitter.on('proxyRes', _instance.logDay.bind(_instance))
    emitter.on('proxyRes', _instance.logArchive.bind(_instance))

    return _instance
  }
})()
