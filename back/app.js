const fs = require('fs')
const log4js = require('log4js')

require('dotenv-flow').config() // 环境变量 默认读取项目根目录下的.env文件

let log4jsConfig
if (fs.existsSync('./config/log4js.js')) {
  log4jsConfig = require('./config/log4js')
} else {
  log4jsConfig = {
    appenders: {
      consoleout: { type: 'console' }
    },
    categories: {
      default: { appenders: ['consoleout'], level: 'debug' }
    },
    pm2: true
  }
}
log4js.configure(log4jsConfig)
const logger = log4js.getLogger('tms-api-gw_app')

process.on('uncaughtException', err => {
  logger.fatal(err)
})

global.prometheus = {
  metrics: {
    gw_access: { // 接口访问情况
      total: 0,
      sendTotal: 0,
      sendFail: 0,
      sendSuccess: 0,
      sendError: 0,
      slow: 0,
    },
    client_access: { // 客户 维度

    },
    api_access: { // api 维度

    }
  }
}

const gateway = require('./lib')

gateway.startup()
