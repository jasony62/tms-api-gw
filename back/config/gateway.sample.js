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
  name: "api-gw",
  proxy: {
    rules: {"/a/b":"/c/d", "/a2/b2":{"target":"/c2/d2","auth":["httpService"],"trace":["mongodb","http"],"transformRequest":["***"]}},
    default: `http://${host}:1234`
  },
  trace: {
    enable: true,
    mongodb: {
      type: "mongodb",
      user: false,
      password: false,
      host,
      port: 27017,
      database: 'tms-api-gw'
    },
    http: {
      type: "http",
      // events: ["recvReq", "sendReq", "response"],
      url: "http://localhost:81",
      before: '' // './*.js' or function(){}  数据发送前的前置操作
    },
    default: ["mongodb"]
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
      type: "http",
      query: ['access_token', 'access_token'],
      url: `http://${host}:3001/auth/client`
    },
    httpService: {
      type: "file",
      path: `./lib/auth/httpService`,
    },
    default: ["http"]
  },
  transformRequest: { // 支持在转发请求前修改请求
    enable: false,
    getToken: "./lib/transformRequest/*.js", // ‘./*.js’ or function() {}
    default: []
  },
  pushMessage: { // sendMessage
    enable: true,
    logPath: '', // 是否需要日志文件
    redis: {
      prefix: 'tms-api-gw-pushMessage',
      host,
      port: 6379,
      password: "",
      channel: 'tms-api-gw-pushMessage',
    }
  },
}
