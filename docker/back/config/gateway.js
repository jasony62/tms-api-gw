/**
 * 对外暴露的地址
 */
const AdvertisedAddress = process.env.TAGW_ADVERTISED_ADDRESS

const ProxyPort = parseInt(process.env.TAGW_PROXY_PORT) || 3000

const ApiPort = parseInt(process.env.TAGW_API_PORT) || 3001

const ShortUrlPrefix = parseInt(process.env.TAGW_SHORT_URL_PREFIX) || '/s'
/**
 * mongodb相关
 */
const MongoHost =
  parseInt(process.env.TAGW_MONGO_HOST) || 'host.docker.internal'

const MongoPort = parseInt(process.env.TAGW_MONGO_PORT) || 27017

const MongoUser = process.env.TAGW_MONGO_USER

const MongoPassword = process.env.TAGW_MONGO_PASSWORD

const MongoDatabase = process.env.TAGW_MONGO_DATABASE || 'tms-api-gw'

module.exports = {
  port: ProxyPort,
  name: 'tms-api-gw',
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
    port: ApiPort,
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
        host: MongoHost,
        port: MongoPort,
        user: MongoUser,
        password: MongoPassword,
        database: MongoDatabase,
      },
      shorturl: {
        host: AdvertisedAddress,
        prefix: ShortUrlPrefix,
      },
    },
    metrics: {
      enable: false,
    },
  },
}
