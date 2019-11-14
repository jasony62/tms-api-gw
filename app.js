const fs = require('fs')
const log4js = require('log4js')

let log4jsConfig
if (fs.existsSync('./config/log4js')) {
  log4jsConfig = require('./config/log4js')
} else {
  log4jsConfig = {
    appenders: {
      consoleout: { type: 'console' }
    },
    categories: {
      default: { appenders: ['consoleout'], level: 'debug' }
    }
  }
}
log4js.configure(log4jsConfig)
const logger = log4js.getLogger('tms-api-gw_app')

process.on('uncaughtException', err => {
  logger.fatal(err)
})

const gateway = require('./lib')

gateway.startup()
