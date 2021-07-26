let host, port, ctrlPort
if (process.env.TMS_API_GW_ENV === 'docker') {
  host = 'docker.for.mac.host.internal'
  port = 3000
  ctrlPort = 3001
} else {
  host = 'localhost'
  port = 5678
  ctrlPort = 5679
}
module.exports = {
  port,
  name: "api-gw",
  proxy: {
    rules: {
      "/a1/b1":"http://localhost/c/d",
      "/a2/b2":{
        "target":"http://localhost/c2/d2",
        "auth":["httpService"],
        "trace":["mongodb","http"],
        "transformRequest":["***"]
      },
      "/a3/b3":{
        "target":[
          {
            "url":"http://localhost/c/d",
            "label":"trial","default":true
          },
          {
            "url":"http://localhost/c2/d2",
            "label":"official"
          }
        ]
      }
    }
  },
  trace: {
    enable: true,
    mongodb: {
      type: "mongodb",
      onlyError: false,
      user: false,
      password: false,
      host,
      port: 27017,
      database: 'tms-api-gw',
      // maxPoolSize: 10 // default 5
    },
    http: {
      type: "http",
      onlyError: false,
      // events: ["recvReq", "sendReq", "response", "checkpoint"],
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
    rule1: {
      rateLimit: {
        minute: {
          limit: 0
        }
      }
    },
    rule2: "./lib/quota/test.js",
    default: []
  },
  auth: {
    enable: false,
    http: {
      type: "http",
      query: ['access_token', 'access_token'],
      url: `http://${host}:3001/auth/client`,
      clientIdField: "id", // 获取用户id的路径
      clientLabelField: "label", // 获取用户标签的路径
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
  API: {
    enable: true,
    port: ctrlPort,
    mongodb: {
      host: host,
      port: 27017,
      database: 'tms-api-gw',
      user: false,
      password: false,
    },
    router: {
      controllers: {
        prefix: "" // 接口调用url的前缀
      },
      metrics: {
        prefix: "/metrics" // metrics url的前缀
      },
    },
    shorturl: {
      host: "http://localhost",
      prefix: "/s"
    },
    metrics: {
      enable: true,
      collectDefault: true, // 是否包含默认系统监控指标
      gatewayProfile: {
        prefix: 'tms_api_gw', // 指标前缀
      },
    }
  },
}
