const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')
const _ = require("lodash")
const fs = require("fs")
const PATH = require("path")
const cronParser = require('cron-parser')

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
  async _getItemRule(req, quotaConfig) {
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
    
    let itemId = null, rateLimit = { rate: "0 * * * * ?", limit: 0 }
    if (quotaConfig.type === "object") {
      let items = []
      for (const itemKey in quotaConfig.item) {
        items.push(_.get(req, quotaConfig["item"][itemKey], ""))
      }
      itemId = items.join(":")
      if (quotaConfig.rateLimit) rateLimit = quotaConfig.rateLimit
    } else if (quotaConfig.type === "http") {

    } else if (quotaConfig.type === "file") { // {itemId:****,rateLimit:****}
      const quoPath = PATH.resolve(quotaConfig.path)
      if (fs.existsSync(quoPath)) {
        const rst = require(quoPath)(req)
        itemId = rst.itemId
        if (rst.rateLimit) rateLimit = rst.rateLimit
      }
    }

    if (!itemId) {
      itemId = `${clientId}:${api}`
    }
  
    return { id: itemId, rateLimit }
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
      const item = await this._getItemRule(req, quotaConfig)
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
      const item = await this._getItemRule(req, quotaConfig)
      const itemId = item.id

      const oRequestAt = new Date(requestAt)
      const year = oRequestAt.getFullYear()
      const month = oRequestAt.getMonth() + 1
      const day = oRequestAt.getDate()

      await this.modelArchive.updateOne(
        { itemId, year, month, day },
        { $set: { latestAt: requestAt }, $inc: { count: 1 } },
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

      const { id: itemId, rateLimit } = await this._getItemRule(req, quoConfig)

      let limit = _.get(rateLimit, "limit", 0)
      limit = +limit
      if (limit < 1) continue

      const doc = await this.modelDay.findOne({ itemId })
      if (doc) {
        if (requestAt < doc.rateNextTime) {
          if (doc.count >= limit) {
            logger.warn(`quota check minuLimit || ${req.headers['x-request-id']} || ${req.originUrl} || ${new Date() * 1 - req.headers['x-request-at']}`, `API 执行流量控制, 限制次数为[${limit}], 周期[${rateLimit.rate}], 请${doc.rateNextTime - requestAt}ms后再次尝试`)
            return Promise.reject({msg: `API 执行流量控制, 限制次数为[${limit}], 周期[${rateLimit.rate}], 请${doc.rateNextTime - requestAt}ms后再次尝试`})
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
