class Quota {
  constructor(Model) {
    this.model = Model
  }
  async logProxyRes(proxyRes, req, res) {
    const clientId = req.headers['x-request-client']
    const api = require('url').parse(req.url).pathname
    const requestAt = req.headers['x-request-at']

    const doc = await this.model.findOne({ clientId, api })
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
      await this.model.create({
        clientId,
        api,
        latestAt: requestAt,
        minute: 1,
        hour: 1,
        day: 1
      })
    }
  }
}

Quota.createModel = function(mongoose) {
  const schema = new mongoose.Schema(
    {
      clientId: String,
      api: String,
      latestAt: Number,
      minute: Number,
      hour: Number,
      day: Number
    },
    { collection: 'quota_day' }
  )

  const Model = mongoose.model('quota_day', schema)

  return Model
}

module.exports = (function() {
  let _instance
  return function(emitter, mongoose) {
    if (_instance) return _instance

    let Model = Quota.createModel(mongoose)

    _instance = new Quota(Model)

    emitter.on('proxyRes', _instance.logProxyRes.bind(_instance))

    return _instance
  }
})()
