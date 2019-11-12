const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw')
const ProxyRules = require('./proxy/rule')
const uuid = require('uuid')
const Context = require('./context')

class Gateway {
  constructor(ctx) {
    this.ctx = ctx
    this.trace = ctx.trace
    this.port = ctx.config.port
    this.rules = new ProxyRules(ctx.config.proxy)
  }
  createGateway() {
    const http = require('http')
    const httpProxy = require('http-proxy')
    //创建代理服务器监听捕获异常事件
    const proxy = httpProxy.createProxyServer()
    proxy.on('error', (err, req, res) => {
      res.end() //异常事件不处理
    })
    proxy.on('proxyRes', (proxyRes, req, res) => {
      this.trace.logResponse(proxyRes, req, res)
    })
    proxy.on('proxyReq', async (proxyReq, req, res, options) => {
      await this.trace.logSendReq(proxyReq, req, res, options)
    })

    const app = http.createServer(async (req, res) => {
      // 设置唯一id，便于跟踪
      req.headers['x-request-id'] = uuid()
      req.headers['x-request-at'] = new Date() * 1

      // 记录原始信息
      this.trace.logRecvReq(req)

      // 匹配路由
      const target = this.rules.match(req)
      if (!target) {
        // 没有匹配的目标直接返回
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      } else {
        //执行反向代理
        proxy.web(req, res, { target })
      }
    })
    app.listen(this.port, () => {
      console.log('server is runing at %d', this.port)
    })
  }
}
Gateway.startup = async function(opt) {
  const ctx = await Context.ins()
  const gateway = new Gateway(ctx)
  gateway.createGateway()
}

module.exports = Gateway
