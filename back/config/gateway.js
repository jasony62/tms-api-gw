let host, port
if (process.env.TMS_API_GW_ENV === 'docker') {
  host = 'docker.for.mac.host.internal'
  port = 3000
} else {
  host = process.env.TMS_APP_HOST || 'localhost'
  port = parseInt(process.env.TMS_APP_PORT) || 3000
}

module.exports = {
  port,
  name: process.env.TMS_APP_NAME || "",
  proxy: {
    rules: process.env.TMS_PROXY_RULES ? JSON.parse(process.env.TMS_PROXY_RULES) : {},
    default: `http://localhost:1234`
  },
  trace: { // 日志
    enable: process.env.TMS_TRACE_ENABLE === "false" ? false : true,
    onlyError:  process.env.TMS_TRACE_ENABLE_ONLYERROR === "true" ? true : false,
    mongodb: {
      type: "mongodb",
      user: process.env.TMS_TRACE_MONGODB_USER || false,
      password: process.env.TMS_TRACE_MONGODB_PASSWORD || false,
      host: process.env.TMS_TRACE_MONGODB_HOST || host,
      port: parseInt(process.env.TMS_TRACE_MONGODB_PORT) || 27017,
      database: process.env.TMS_TRACE_MONGODB_DATABASE || 'tms-api-gw-jh'
    },
    http: {
      type: "http",
      events: process.env.TMS_TRACE_SEND_EVENTS ? JSON.parse(process.env.TMS_TRACE_SEND_EVENTS) : ["recvReq", "sendReq", "response"],
      url: process.env.TMS_TRACE_SEND_URL || ""
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
      database: process.env.TMS_QUOTA_MONGODB_DATABASE || 'tms-api-gw-jh'
    },
    rules: {
      rateLimit: {
        minute: {
          limit: process.env.TMS_QUOTA_RATELIMIT_MINUTE || 0
        }
      }
    }
  },
  auth: {
    enable: process.env.TMS_AUTH_ENABLE === "true" ? true : false,
    http: {
      type: "http",
      path: process.env.TMS_AUTH_HTTP_PATH || false,
      query: process.env.TMS_AUTH_HTTP_QUERY ? JSON.parse(process.env.TMS_AUTH_HTTP_QUERY) : ['access_token', 'access_token'],
      url: process.env.TMS_AUTH_HTTP_URL || "http://localhost/auth/token",
      clientIdField: process.env.TMS_AUTH_HTTP_CLIENTIDFIELD || "id",
    },
    httpPortal: {
      type: "file",
      path: process.env.TMS_AUTH_HTTPPORT_PATH,
      clientIdField: process.env.TMS_AUTH_HTTPPOR_CLIENTIDFIELD || "id",
    },
    httpService: {
      type: "file",
      path: process.env.TMS_AUTH_HTTPSV_PATH,
      clientIdField: process.env.TMS_AUTH_HTTPSER_CLIENTIDFIELD || "id",
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
}
