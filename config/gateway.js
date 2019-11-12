module.exports = {
  port: 5678,
  proxy: {
    rules: {},
    default: 'http://localhost:1234'
  },
  trace: {
    mongodb: { host: 'localhost', port: 27017, database: 'tms-api-gw' }
  },
  quota: {
    mongodb: { host: 'localhost', port: 27017, database: 'tms-api-gw' },
    rules: {}
  },
  auth: {
    http: {
      url: 'http://localhost:3001/auth/client'
    }
  }
}
