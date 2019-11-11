module.exports = {
  port: 5678,
  proxy: {
    rules: {},
    default: 'http://localhost:1234'
  },
  storage: {
    mongodb: { host: 'localhost', port: 27017, database: 'tms-api-gw' }
  },
  queue: { redis: { host: '127.0.0.1', port: 6379 } },
  auth: { redis: {} },
  quota: {}
}
