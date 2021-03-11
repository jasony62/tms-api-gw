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
    send: `http://${host}:1234`,
    sendThird: { 
      url: `http://${host}:1234`, // 第三方url地址
      events: ["recvReq", "sendReq", "response"] // 需要发送的事件，默认都发送
    },
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
    rules: {
      rateLimit: {
        minute: {
          limit: 0
        }
      }
    }
  },
  auth: {
    enable: false,
    onlyError: false,
    http: {
      query: ['access_token', 'access_token'],
      url: `http://${host}:3001/auth/client`
    }
  }
}
