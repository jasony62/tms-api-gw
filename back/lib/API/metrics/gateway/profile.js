const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw-metrics-gateway')
const { Counter } = require('prom-client')

/**
 * 
 */
async function getTraceLogTotal(ctx, latestTs, latestTotal) {
  const trace = ctx.trace
  if (trace.config.enable !== true || !trace.config.default.length) {
    return false
  }

  const traceMongoConn = trace.traceInstanceMap.get(trace.config.default[0])
  const curr = Date.now()
  let skip = 0, total = 0, limit = 100000
  while (true) {
    const count = await traceMongoConn
      .mongoose
      .countDocuments({requestAt: {$gt: latestTs}})
      .hint({_id:1})
      .skip(skip)
      .limit(limit)

    total += count
    skip += limit
    if (count < limit) break
  }
  const curr2 = Date.now()
  logger.debug("getTraceLogTotal 耗时 1", curr2 - curr)
  const countTotal = await traceMongoConn
      .mongoose
      .countDocuments({requestAt: {$gt: latestTs}, statusCode: {$ne: 0}})
      .hint({_id:1})

  logger.debug("getTraceLogTotal 耗时 2", Date.now() - curr2)
  return [{
    status: "all",
    total,
  },
  {
    status: "fail",
    total: countTotal,
  }]
}

/* 实现一个时间只取一次*/
const OnlyOnceFetch = {
  latestTs: -1,
  latestPromise: null,
  latestTotal: {},
  run: async (host) => {
    if (host.latestTs != this.latestTs) {
      this.latestPromise = new Promise(async (resolve) => {
        let result = await getTraceLogTotal(host.ctx, host.latestTs, host.latestTotal)
        host.latestTs = new Date()
        result.forEach((v) => {
          if (host.latestTotal[v.status]) {
            host.latestTotal[v.status]["total"] += v.total
          } else {
            host.latestTotal[v.status] = {total:v.total}
          }
        })
        resolve(result)
      })
      this.latestTs = host.latestTs
      this.latestTotal = host.latestTotal
    }
    return this.latestPromise
  },
}

/***/
const getMetrics = {
  run: async (host) => {
    const slow = prometheus.metrics.gw_access.slow // 慢接口
    const total = prometheus.metrics.gw_access.total
    const sendTotal = prometheus.metrics.gw_access.sendTotal
    const sendFail = prometheus.metrics.gw_access.sendFail
    const sendSuccess = prometheus.metrics.gw_access.sendSuccess
    const sendError = prometheus.metrics.gw_access.sendError
    let metricsDatas = [{
      type: "total",
      total: total,
    },
    {
      type: "sendTotal",
      total: sendTotal,
    },
    {
      type: "sendFail",
      total: sendFail,
    },
    {
      type: "sendSuccess",
      total: sendSuccess,
    },
    {
      type: "slow",
      total: slow,
    },
    {
      type: "sendError",
      total: sendError,
    }]
    prometheus.metrics.gw_access.slow = 0
    prometheus.metrics.gw_access.total = 0
    prometheus.metrics.gw_access.sendTotal = 0
    prometheus.metrics.gw_access.sendFail = 0
    prometheus.metrics.gw_access.sendSuccess = 0
    prometheus.metrics.gw_access.sendError = 0
    // 用户
    const client_access = prometheus.metrics.client_access
    for (const clientId in client_access) {
      const data = client_access[clientId]
      metricsDatas.push({
        client: clientId,
        type: "sendTotal",
        total: data.sendTotal
      })
      metricsDatas.push({
        client: clientId,
        type: "sendFail",
        total: data.sendFail
      })
      metricsDatas.push({
        client: clientId,
        type: "sendSuccess",
        total: data.sendSuccess
      })
      metricsDatas.push({
        client: clientId,
        type: "sendError",
        total: data.sendError
      })
      metricsDatas.push({
        client: clientId,
        type: "slow",
        total: data.slow
      })
      data.sendTotal = 0
      data.sendFail = 0
      data.sendSuccess = 0
      data.sendError = 0
      data.slow = 0
    }
    // 慢接口
    const api_access = prometheus.metrics.api_access
    for (const api in api_access) {
      const data = api_access[api]
      metricsDatas.push({
        api,
        type: "sendTotal",
        total: data.sendTotal
      })
      metricsDatas.push({
        api,
        type: "sendFail",
        total: data.sendFail
      })
      metricsDatas.push({
        api,
        type: "sendSuccess",
        total: data.sendSuccess
      })
      metricsDatas.push({
        api,
        type: "sendError",
        total: data.sendError
      })
      metricsDatas.push({
        api,
        type: "slow",
        total: data.slow
      })
      data.sendTotal = 0
      data.sendFail = 0
      data.sendSuccess = 0
      data.sendError = 0
      data.slow = 0
    }

    return metricsDatas
  },
}

/**
 *
 */
class ProfileGateway {
  constructor(ctx, prefix, metricsContext) {
    this.ctx = ctx
    this.prefix = prefix
    this.metricsContext = metricsContext
    this.latestTs = process.env.TMS_METRICS_REGAIN ? new Date(0) : new Date()
    this.latestTotal = {}
  }

  async run() {
    const metricsContext = this.metricsContext

    let prefix = this.prefix
    const total = new Counter({
      name: `${prefix}_access_total`,
      help: '当前新增访问量',
      labelNames: ['type', "client", "api"],
      registers: [metricsContext.register],
      collect: async () => {
        await getMetrics.run(this).then((result) => {
          result.forEach((nsData) => {
            total.labels({ type: nsData.type, client: nsData.client || "", api: nsData.api || "" }).inc(nsData.total)
          })
        })
        // await OnlyOnceFetch.run(this).then((result) => {
        //   result.forEach((nsData) => {
        //     total.labels({ status: nsData.status }).inc(nsData.total)
        //   })
        // })
      },
    })
  }
}

module.exports = { ProfileGateway }
