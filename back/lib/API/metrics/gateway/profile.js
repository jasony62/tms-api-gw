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
    // total: latestTotal.all ? total - latestTotal.all.total : total,
    total,
  },
  {
    status: "fail",
    // total: latestTotal.fail ? countTotal - latestTotal.fail.total : countTotal,
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
      name: `${prefix}_trace_log_total`,
      help: '当前新增访问量',
      labelNames: ['status'],
      registers: [metricsContext.register],
      collect: async () => {
        await OnlyOnceFetch.run(this).then((result) => {
          result.forEach((nsData) => {
            total.labels({ status: nsData.status }).inc(nsData.total)
          })
        })
      },
    })
  }
}

module.exports = { ProfileGateway }
