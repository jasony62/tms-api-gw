module.exports = {
  port: 5678,
  proxy: {
    rules: {},
    default: 'http://localhost:1234'
  },
  trace: {
    mongodb: { host: 'localhost', port: 27017, database: 'tms-api-gw' }
  },
  auth: {
    http: {
      url: 'http://localhost:3001/auth/client'
    }
  },
  event: { redis: { host: '127.0.0.1', port: 6379 } },
  quota: {
    client: { default: 100 },
    api: { default: 100 },
    clientApi: { default: 100 }
  }
}
