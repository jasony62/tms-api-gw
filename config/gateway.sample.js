let host, port
if (process.env.TMS_API_GW_ENV === 'docker') {
  host = 'docker.for.mac.host.internal'
  port = 3000
} else {
  host = 'localhost'
  port = 5678
}
module.exports = {
  port,
  proxy: {
    rules: {},
    default: `http://${host}:1234`
  },
  trace: {
    enable: true,
    mongodb: {
      host,
      port: 27017,
      database: 'tms-api-gw'
    }
  },
  quota: {
    enable: true,
    mongodb: {
      host,
      port: 27017,
      database: 'tms-api-gw'
    },
    rules: {}
  },
  auth: {
    enable: false,
    http: {
      url: `http://${host}:3001/auth/client`
    }
  }
}
