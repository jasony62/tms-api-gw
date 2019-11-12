module.exports = {
  port: 5678,
  proxy: {
    rules: {},
    default: 'http://localhost:1234'
  },
  trace: {
    mongodb: { host: 'localhost', port: 27017, database: 'tms-api-gw' }
  },
  auth: { redis: { host: '127.0.0.1', port: 6379, channel: 'tms-api-gw' } },
  queue: { redis: { host: '127.0.0.1', port: 6379 } },
  quota: {}
}
