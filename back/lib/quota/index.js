class Quota {
  constructor(ModelDay, ModelArchive, rules) {
    this.modelDay = ModelDay
    this.modelArchive = ModelArchive
    this.rules = rules
  }
  /**
   *
   * @param {*} req
   */
  getReqInfo(req) {
    const clientId = req.headers['x-request-client']
    const api = require('url').parse(req.url).pathname
    const requestAt = req.headers['x-request-at']

    return { clientId, api, requestAt }
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
  check(req) {
    const { clientId, api, requestAt } = this.getReqInfo(req)

    return true
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
  return function(emitter, mongoose, rules) {
    if (_instance) return _instance

    let ModelDay = Quota.createModelDay(mongoose)
    let ModelArchive = Quota.createModelArchive(mongoose)

    _instance = new Quota(ModelDay, ModelArchive, rules)

    emitter.on('proxyRes', _instance.logDay.bind(_instance))
    emitter.on('proxyRes', _instance.logArchive.bind(_instance))

    return _instance
  }
})()
