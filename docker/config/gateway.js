let host, port, ctrlPort
/**
 * 对外暴露的地址
 */
const AdvertisedAddress = process.env.TMS_API_GW_ADVERTISED_ADDRESS

host = 'host.docker.internal'
port = 3000
ctrlPort = 3001

module.exports = {
  port,
  name: 'api-gw',
  proxy: {
    rules: {},
  },
  trace: {
    enable: false,
  },
  quota: {
    enable: false,
  },
  auth: {
    enable: false,
  },
  transformRequest: {
    // 支持在转发请求前修改请求
    enable: false,
  },
  transformResponse: {
    enable: false,
  },
  pushMessage: {
    // sendMessage
    enable: false,
  },
  API: {
    enable: true,
    port: ctrlPort,
    router: {
      controllers: {
        prefix: '/api', // 接口调用url的前缀
      },
      metrics: {
        prefix: '/metrics', // metrics url的前缀
      },
    },
    controllers: {
      enable: true,
      mongodb: {
        host: host,
        port: 27017,
        database: 'tms-api-gw',
        user: 'root',
        password: 'root',
      },
      shorturl: {
        host: AdvertisedAddress,
        prefix: '/s',
      },
    },
    metrics: {
      enable: false,
    },
  },
}
