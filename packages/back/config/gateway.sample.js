let host, port, ctrlPort
if (process.env.TMS_API_GW_ENV === 'docker') {
  host = 'host.docker.internal'
  port = 3000
  ctrlPort = 3001
} else {
  host = 'localhost'
  port = 5678
  ctrlPort = 5679
}
module.exports = {
  port,
  name: 'tms-api-gw',
  proxy: {
    rules: {
      '/a1/b1': 'http://localhost/c/d',
      '/a2/b2': {
        target: 'http://localhost/c2/d2',
        auth: ['httpService'],
        trace: ['mongodb', 'http'],
        transformRequest: ['***'],
      },
      '/a3/b3': {
        target: [
          {
            url: 'http://localhost/c/d',
            label: 'trial',
            default: true,
          },
          {
            url: 'http://localhost/c2/d2',
            label: 'official',
          },
        ],
      },
    },
  },
  trace: {
    enable: true,
    mongodb: {
      type: 'mongodb',
      onlyError: false,
      user: false,
      password: false,
      host,
      port: 27017,
      database: 'tms-api-gw',
      // maxPoolSize: 10 // default 5
    },
    http: {
      type: 'http',
      onlyError: false,
      // events: ["recvReq", "sendReq", "response", "checkpoint"],
      url: 'http://localhost:81',
      before: '', // './*.js' or function(){}  数据发送前的前置操作
    },
    default: ['mongodb'],
  },
  quota: {
    enable: true,
    mongodb: {
      host,
      port: 27017,
      database: 'tms-api-gw',
    },
    rule_test: './lib/quota/test.js',
    statistical_Day: {
      type: 'object',
      item: {
        custid: 'headers.x-request-client',
        api: 'originUrlObj.pathname',
      },
      rateLimit: {
        // rate: '0 * * * * ?',
        rate: null,
        limit: 0,
      },
    },
    http_test: {
      type: 'http',
      url: 'http://localhost/api',
      parameter: {
        url: 'originUrl',
        headers: 'headers',
        client: 'clientInfo',
      },
      itemIdField: 'result.0.id',
      rateLimitField: 'result.0.rateLimit',
      attachedField: 'result.0.attachedField',
    },
    default: ['statistical_Day'],
  },
  auth: {
    enable: false,
    http: {
      type: 'http',
      query: ['access_token', 'access_token'],
      url: `http://${host}:3001/auth/client`,
      clientIdField: 'id', // 获取用户id的路径
      clientLabelField: null, // 获取用户标签的路径
    },
    httpService: {
      type: 'file',
      path: `./lib/auth/httpService`,
    },
    default: ['http'],
  },
  transformRequest: {
    // 支持在转发请求前修改请求
    enable: false,
    getToken: './lib/transformRequest/*.js', // ‘./*.js’ or function() {}
    default: [],
  },
  transformResponse: {
    enable: false,
    test_ase: './lib/transformResponse/test_ase.js',
    default: [],
  },
  pushMessage: {
    // sendMessage
    enable: true,
    logPath: '', // 是否需要日志文件
    redis: {
      prefix: 'tms-api-gw-pushMessage',
      host,
      port: 6379,
      password: '',
      channel: 'tms-api-gw-pushMessage',
    },
  },
  API: {
    enable: true,
    port: ctrlPort,
    router: {
      controllers: {
        prefix: '', // 接口调用url的前缀
      },
      metrics: {
        prefix: '/metrics', // metrics url的前缀
      },
    },
    controllers: {
      enable: false,
      mongodb: {
        host: host,
        port: 27017,
        database: 'tms-api-gw',
        user: false,
        password: false,
      },
      shorturl: {
        host: 'http://localhost',
        prefix: '/s',
      },
    },
    metrics: {
      enable: false,
      collectDefault: true, // 是否包含默认系统监控指标
      gatewayProfile: {
        prefix: 'tms_api_gw', // 指标前缀
      },
      slowQueryTimeout: process.env.TMS_METRICS_SLOWQUERYTIMEOUT || 1000, // 耗时1000毫秒后记为慢接口
    },
  },
}
