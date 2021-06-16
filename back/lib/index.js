const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw_idx')
const ProxyRules = require('./proxy/rule')
const uuid = require('uuid')
const Context = require('./context')
const quota = require('./quota')

class Gateway {
  constructor(ctx) {
    this.ctx = ctx
    this.port = ctx.config.port
    this.rules = new ProxyRules(ctx.config.proxy)
  }
  createGateway() {
    const http = require('http')
    const httpProxy = require('http-proxy')
    //创建代理服务器监听捕获异常事件
    const proxy = httpProxy.createProxyServer()
    // 异常事件不处理
    proxy.on('error', (err, req, res) => {
      logger.error("logError " + req.originUrl, err)
      res.end()
    })
    // 准备发送请求
    proxy.on('proxyReq', async (proxyReq, req, res, options) => {
      this.ctx.emitter.emit('proxyReq', proxyReq, req, res, options, this.ctx)
    })
    // 处理获得的响应
    proxy.on('proxyRes', (proxyRes, req, res) => {
      this.ctx.emitter.emit('proxyRes', proxyRes, req, res, this.ctx)
    })
    // 启动http服务
    const app = http.createServer(async (req, res) => {
      // 设置唯一id，便于跟踪
      req.headers['x-request-id'] = uuid()
      req.headers['x-request-at'] = new Date() * 1
      
      // 冗余属性存放
      let redundancyOptions = {}
      // 匹配路由
      let target = this.rules.match(req, redundancyOptions)
      if (!target) {
        // 没有匹配的目标直接返回
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('Not found')
      }

      // 记录收到请求的原始信息
      this.ctx.emitter.emit('recvReq', req, res, this.ctx)

      // 身份认证
      let clientId
      if (this.ctx.auth) {
        try {
          clientId = await this.ctx.auth.check(req, res, redundancyOptions)
        } catch (err) {
          logger.error("auth", req.url, err)
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "auth", err)
          res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end(err.msg)
        }
        req.headers['x-request-client'] = clientId
      }

      // 检查配额
      if (this.ctx.quota && clientId) {
        try {
          await this.ctx.quota.check(req)
        } catch (err) {
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "quota", err)
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end(err.msg)
        }
      }

      // 转换请求
      if (this.ctx.transformRequest) {
        try {
          const rst = await this.ctx.transformRequest.check(clientId, req, target, redundancyOptions)
          if (rst.target) target = rst.target
        } catch (err) {
          logger.error("transformRequest", req.url, err)
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end(err.msg)
        }
      }
      // 执行反向代理
      proxy.web(req, res, { target })

      // 复制请求
    })
    app.listen(this.port, () => {
      logger.info('Tms Api Gateway is runing at %d', this.port)
    })
  }
}
Gateway.startup = async function() {
  try {
    const ctx = await Context.ins()
    const gateway = new Gateway(ctx)
    gateway.createGateway()
  } catch (e) {
    const http = require('http')
    const app = http.createServer(async (req, res) => {
      logger.error("createGateway", e)
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end(e.message)
    })
    app.listen(3000, () => {
      logger.warn('Tms Api Gateway startup fail: ', e)
      logger.info('Tms Api Gateway is runing at 3000')
    })
  }
}

module.exports = Gateway
