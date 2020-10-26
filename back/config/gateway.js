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
  proxy: {
    rules: process.env.TMS_PROXY_RULES ? JSON.parse(process.env.TMS_PROXY_RULES) : {},
    default: `http://localhost:1234`
  },
  trace: {
    enable: process.env.TMS_TRACE_ENABLE === "false" ? false : true,
    mongodb: {
      user: process.env.TMS_TRACE_MONGODB_USER || false,
      password: process.env.TMS_TRACE_MONGODB_PASSWORD || false,
      host: process.env.TMS_TRACE_MONGODB_HOST || host,
      port: parseInt(process.env.TMS_TRACE_MONGODB_PORT) || 27017,
      database: process.env.TMS_TRACE_MONGODB_DATABASE || 'tms-api-gw-jh'
    }
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
    rules: {}
  },
  auth: {
    enable: process.env.TMS_TRACE_ENABLE === "true" ? true : false,
    http: {
      query: process.env.TMS_AUTH_HTTP_QUERY ? JSON.parse(process.env.TMS_AUTH_HTTP_QUERY) : ['access_tocken', 'access_tocken'],
      url: process.env.TMS_AUTH_HTTP_URL || "http://localhost:3001/auth/token",
      clientIdField: process.env.TMS_AUTH_HTTP_CLIENTIDFIELD || "id"
    }
  }
}
