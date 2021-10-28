let host, port, ctrlPort
if (process.env.TMS_API_GW_ENV === 'docker') {
  host = 'docker.for.mac.host.internal'
  port = 3000
  ctrlPort = 3001
} else {
  host = process.env.TMS_APP_HOST || 'localhost'
  port = parseInt(process.env.TMS_APP_PORT) || 3000
  ctrlPort = parseInt(process.env.TMS_APP_CTRLPORT) || 3001
}

module.exports = {
  port,
  name: process.env.TMS_APP_NAME || "",
  proxy: {
    rules: process.env.TMS_PROXY_RULES ? JSON.parse(process.env.TMS_PROXY_RULES) : {}
  },
  transformRequest: {
    enable: process.env.TMS_TRACEFORNREQ_ENABLE === "false" ? false : true,
    getToken: "./lib/transformRequest/getToken.js",
    callticket_down: "./lib/transformRequest/callticket_down.js",
    binding: "./lib/transformRequest/binding.js",
    test: "./lib/transformRequest/test.js",
    default: process.env.TMS_TRANSFORM_DEFAULT ? JSON.parse(process.env.TMS_TRANSFORM_DEFAULT) : []
  },
  transformResponse: {
    enable: process.env.TMS_TRACEFORNRES_ENABLE === "true" ? true : false,
    test: "./lib/transformResponse/test.js",
    default: process.env.TMS_TRANSFORMRES_DEFAULT ? JSON.parse(process.env.TMS_TRANSFORMRES_DEFAULT) : []
  },
  trace: { // 日志
    enable: process.env.TMS_TRACE_ENABLE === "false" ? false : true,
    mongodb: {
      type: "mongodb",
      onlyError: process.env.TMS_TRACE_ENABLE_ONLYERROR === "true" ? true : false,
      user: process.env.TMS_TRACE_MONGODB_USER || false,
      password: process.env.TMS_TRACE_MONGODB_PASSWORD || false,
      host: process.env.TMS_TRACE_MONGODB_HOST || host,
      port: parseInt(process.env.TMS_TRACE_MONGODB_PORT) || 27017,
      database: process.env.TMS_TRACE_MONGODB_DATABASE || 'tms-api-gw-jh',
      maxPoolSize: parseInt(process.env.TMS_TRACE_MONGODB_MAXPOOLSIZE) || 100,
      events: process.env.TMS_TRACE_MONGO_EVENTS ? JSON.parse(process.env.TMS_TRACE_MONGO_EVENTS) : ["recvReq", "sendReq", "response", "checkpoint"]
    },
    mongodb_callticket: {
      type: "mongodb",
      onlyError: true,
      user: process.env.TMS_TRACE_MONGODB_USER || false,
      password: process.env.TMS_TRACE_MONGODB_PASSWORD || false,
      host: process.env.TMS_TRACE_MONGODB_HOST || host,
      port: parseInt(process.env.TMS_TRACE_MONGODB_PORT) || 27017,
      database: process.env.TMS_TRACE_MONGODB_DATABASE || 'tms-api-gw-jh',
      maxPoolSize: parseInt(process.env.TMS_TRACE_MONGODB_MAXPOOLSIZE) || 100,
    },
    http: {
      type: "http",
      events: process.env.TMS_TRACE_SEND_EVENTS ? JSON.parse(process.env.TMS_TRACE_SEND_EVENTS) : ["response"], //["recvReq", "sendReq", "response", "checkpoint"]
      url: process.env.TMS_TRACE_SEND_URL || "",
      before: './lib/trace/httpBeforeFun.js'
    },
    default: ["mongodb"]
  },
  quota: {
    enable: process.env.TMS_QUOTA_ENABLE === "false" ? false : true,
    mongodb: {
      user: process.env.TMS_QUOTA_MONGODB_USER || false,
      password: process.env.TMS_QUOTA_MONGODB_PASSWORD || false,
      host: process.env.TMS_QUOTA_MONGODB_HOST || host,
      port: parseInt(process.env.TMS_QUOTA_MONGODB_PORT) || 27017,
      database: process.env.TMS_QUOTA_MONGODB_DATABASE || 'tms-api-gw-jh',
      maxPoolSize: parseInt(process.env.TMS_TRACE_MONGODB_MAXPOOLSIZE) || 100
    },
    rule_all: {
      rateLimit: {
        minute: {
          limit: process.env.TMS_QUOTA_RATELIMIT_MINUTE || 0
        }
      }
    },
    rule_test: "./lib/quota/test.js",
    default: []
  },
  auth: {
    enable: process.env.TMS_AUTH_ENABLE === "true" ? true : false,
    http: {
      type: "http",
      query: process.env.TMS_AUTH_HTTP_QUERY ? JSON.parse(process.env.TMS_AUTH_HTTP_QUERY) : ['access_token', 'access_token'],
      url: process.env.TMS_AUTH_HTTP_URL || "http://localhost/auth/token",
      clientIdField: process.env.TMS_AUTH_HTTP_CLIENTIDFIELD || "id",
      clientLabelField: process.env.TMS_AUTH_HTTP_CLIENTLABELFIELD || null,
    },
    httpPortal: {
      type: "file",
      path: "./lib/auth/auth.js",
    },
    httpService: {
      type: "file",
      path: "./lib/auth/serviceAuth.js",
    },
    httpYz: {
      type: "file",
      path: "./lib/auth/yz_auth.js",
    },
    noauth: {
      type: "file",
      path: "./lib/auth/noAuth.js",
    },
    createCust: {
      type: "file",
      path: "./lib/auth/creatCust.js"
    },
    default: ["http"]
  },
  pushMessage: { // sendMessage
    enable: process.env.TMS_SENDMESSAGE_ENABLE === "true" ? true : false,
    logPath: process.env.TMS_SENDMESSAGE_LOGPATH || '',
    redis: {
      prefix: process.env.TMS_REDIS_PREFIX || 'tms-api-gw-pushMessage',
      host: process.env.TMS_SENDMESSAGE_REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.TMS_SENDMESSAGE_REDIS_PORT) || 6379,
      password: process.env.TMS_SENDMESSAGE_REDIS_PWD || "",
      channel: process.env.TMS_SENDMESSAGE_REDIS_CHANNEL || 'tms-api-gw-pushMessage',
    }
  },
  API: {
    enable: process.env.TMS_API_ENABLE === "true" ? true : false,
    port: ctrlPort,
    router: {
      controllers: {
        prefix: process.env.TMS_APP_ROUTER_CONTROLLER || "" // 接口调用url的前缀
      },
      metrics: {
        prefix: process.env.TMS_METRICS_ROUTER_PREFIX || "/metrics" // metrics url的前缀
      },
    },
    controllers: {
      enable: process.env.TMS_CONTROLLER_ENABLE === "true" ? true : false,
      mongodb: {
        host: process.env.TMS_CTRL_MONGODB_HOST || host,
        port: parseInt(process.env.TMS_CTRL_MONGODB_PORT) || 27017,
        database: process.env.TMS_CTRL_MONGODB_DATABASE || 'tms-api-gw-jh',
        user: process.env.TMS_CTRL_MONGODB_USER || false,
        password: process.env.TMS_CTRL_MONGODB_PASSWORD || false,
        maxPoolSize: parseInt(process.env.TMS_CTRL_MONGODB_MAXPOOLSIZE) || 100,
      },
      shorturl: {
        host: process.env.TMS_APP_SHORTURL_HOST || "http://localhost",
        prefix: process.env.TMS_APP_SHORTURL_PREFIX || "/s"
      }
    },
    metrics: {
      enable: process.env.TMS_METRICS_ENABLE === "true" ? true : false,
      collectDefault: process.env.TMS_METRICS_COLLECTDEFAULT || true, // 是否包含默认系统监控指标
      gatewayProfile: {
        prefix: process.env.TMS_METRICS_GWPROFILE_PREFIX || 'tms_api_gw', // 指标前缀
      },
      slowQueryTimeout: process.env.TMS_METRICS_SLOWQUERYTIMEOUT || 1000, // 耗时1000毫秒后记为慢接口
    }
  },
}
