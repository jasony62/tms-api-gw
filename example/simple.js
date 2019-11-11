const log4jsConfig = require('../config/log4js')
const log4js = require('log4js')
log4js.configure(log4jsConfig)

const gateway = require('../lib')

gateway.startup()
