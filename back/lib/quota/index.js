const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')
const _ = require("lodash")
const fs = require("fs")
const PATH = require("path")

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
    const api = require('url').parse(req.originUrl).pathname
    const requestAt = req.headers['x-request-at']
    const targetRule = req.targetRule

    return { clientId, api, requestAt, targetRule }
  }
  /**
   *  
   */
  _getReqQuotaRule(targetRule) {
    let getReqTargetRuless
    if (targetRule.quota && Array.isArray(targetRule.quota)) {
      getReqTargetRuless = targetRule.quota
    } else {
      getReqTargetRuless = this.defaultQuota
    }
    return getReqTargetRuless
  }
  /**
   * 记录当天数据
   *
   * @param {*} proxyRes
   * @param {*} req
   * @param {*} res
   */
  async logDay(proxyRes, req, res) {
    const { clientId, api, requestAt } = this.getReqInfo(req)

    const doc = await this.modelDay.findOne({ clientId, api })
    if (doc) {
      let { minute = 0, hour = 0, day = 0 } = doc
      let oLatestAt = new Date(doc.latestAt)
      let oRequestAt = new Date(requestAt)
      oLatestAt.setSeconds(0, 0)
      oRequestAt.setSeconds(0, 0)
      let diff = oRequestAt - oLatestAt
      if (diff < 60000) {
        minute++
        hour++
        day++
      } else if (diff < 3600000) {
        minute = 1
        hour++
        day++
      } else if (diff < 86400000) {
        minute = hour = 1
        day++
      } else {
        minute = hour = day = 1
      }

      await doc.updateOne({ $set: { latestAt: requestAt, minute, hour, day } })
    } else {
      await this.modelDay.create({
        clientId,
        api,
        latestAt: requestAt,
        minute: 1,
        hour: 1,
        day: 1
      })
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
    const { clientId, api, requestAt } = this.getReqInfo(req)

    const oRequestAt = new Date(requestAt)
    const year = oRequestAt.getFullYear()
    const month = oRequestAt.getMonth() + 1
    const day = oRequestAt.getDate()

    await this.modelArchive.updateOne(
      { clientId, api, year, month, day },
      { $set: { latestAt: requestAt }, $inc: { count: 1 } },
      { upsert: true }
    )
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
      const quoRul = this.quotaRulesMap.get(reqQuoRul)
      let rule
      if (Object.prototype.toString.call(quoRul) === "[object Object]") {
        rule = Object.assign({}, quoRul)
      } else if (typeof quoRul === "string") {
        const quoPath = PATH.resolve(quoRul)
        if (fs.existsSync(quoPath)) {
          const r = require(quoPath)(req)
          rule = Object.assign({}, r)
        }
      }
      if (Object.prototype.toString.call(rule) !== "[object Object]") {
        return Promise.reject({msg: `解析错误：控制规则不是一个object`})
      }

      let minuLimit = _.get(rule, "rateLimit.minute.limit", null)
      minuLimit = +minuLimit
      if (minuLimit < 1) continue

      const doc = await this.modelDay.findOne({ clientId, api })
      if (doc) {
        let oLatestAt = new Date(doc.latestAt)
        let oRequestAt = new Date(requestAt)
        oLatestAt.setSeconds(0, 0)
        oRequestAt.setSeconds(0, 0)
        let diff = oRequestAt - oLatestAt
        if (diff < 60000) {
          if (minuLimit <= doc.minute) {
            logger.warn(`quota check minuLimit || ${req.headers['x-request-id']} || ${req.originUrl} || ${new Date() * 1 - req.headers['x-request-at']}`, `api 执行流量控制，限制次数为[${minuLimit}]，周期为[分]，当前次数[${doc.minute}]`)
            return Promise.reject({msg: `api 执行流量控制，限制次数为[${minuLimit}]，周期为[分]，当前次数[${doc.minute + 1}]`})
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
      clientId: String,
      api: String,
      latestAt: Number,
      minute: Number,
      hour: Number,
      day: Number
    },
    { collection: 'counter_day' }
  )

  const Model = mongoose.model('counter_day', schema)

  return Model
}
Quota.createModelArchive = function(mongoose) {
  const schema = new mongoose.Schema(
    {
      clientId: String,
      api: String,
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

    const { default: defaultQuota, ...rules } = config
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
