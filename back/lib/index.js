const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-api-gw_idx')
const ProxyRules = require('./proxy/rule')
const uuid = require('uuid')
const { Context } = require('./context')
const http = require('http')
const _ = require("lodash")
const _url = require('url')

function ip(req) {

  const clientIP = req.headers['x-real-ip'] || 
    req.headers['x-forwarded-for'] || 
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress || 
    req.ip || ''

  let ip = clientIP.match(/\d+.\d+.\d+.\d+/)
  ip = ip ? ip.join('.') : null

  return ip
}

class Gateway {
  constructor(ctx) {
    this.ctx = ctx
    this.port = ctx.config.port
    this.rules = new ProxyRules(ctx)
  }
  /**
   * gateway
   */
  createGateway() {
    const streamify = require('stream-array')
    const httpProxy = require('http-proxy')
    //创建代理服务器监听捕获异常事件
    const proxy = httpProxy.createProxyServer()
    // 异常事件不处理
    proxy.on('error', (err, req, res) => {
      this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "error", err)
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(err.toString())
    })
    // 准备发送请求
    proxy.on('proxyReq', async (proxyReq, req, res, options) => {
      this.ctx.emitter.emit('proxyReq', proxyReq, req, res, options, this.ctx)
    })
    // 处理获得的响应
    proxy.on('proxyRes', async (proxyRes, req, res) => {
      const disposeResponse = { // 获取响应dody
        body: null,
        statusCode: proxyRes.statusCode,
        headers: proxyRes.headers,
        getBody: async function() {
          if (this.body !== null) return this.body
          return new Promise((resolve, reject) => {
            let rst = []
            proxyRes.on('data', chunk => {
              rst.push(chunk)
            })
            proxyRes.on('end', async () => {
              rst = Buffer.concat(rst).toString()
              this.setBody(rst)
              return resolve(rst)
            })
          })
        },
        setBody: function(data) {
          this.body = data
        },
        setStatusCode: function(code) {
          this.statusCode = code
        },
        setHeader: function(header) {
          this.headers = header
        },
        end: function() {
          res.writeHead(this.statusCode, this.headers)
          res.write(this.body)
          return res.end()
        }
      }

      this.ctx.emitter.emit('proxyRes', proxyRes, req, res, this.ctx, disposeResponse)

      // 响应拦截器
      if (this.ctx.transformResponse) {
        try {
          await this.ctx.transformResponse.check(req, disposeResponse)
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "transformResponse")
        } catch (err) {
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "transformResponse", err)
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end(err.msg)
        }
      }
    })
    // 启动http服务
    const app = http.createServer(async (req, res) => {
      // 设置唯一id，便于跟踪
      if (!req.headers['x-request-id']) {
        req.headers['x-request-id'] = uuid()
      }
      req.headers['x-request-at'] = new Date() * 1

      // 获取真实ip地址
      const clientIP = ip(req)
      req.headers['x-request-ip'] = clientIP

      // 获取转发规则
      const getTargetRst = await this.rules.getTargetRules(req)
      const targetRule = getTargetRst.targetRule
      if (!targetRule) {
        // 没有匹配的目标直接返回
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('Not found targetRule')
      } else {
        req.targetRule = targetRule
        req.url = getTargetRst.newReqUrl
        req.urlPrefix = getTargetRst.urlPrefix
        req.originUrl = getTargetRst.originUrl
        req.originUrlObj = _.pick(_url.parse(req.originUrl, true), [
          'protocol',
          'hostname',
          'port',
          'pathname',
          'query'
        ])
      }

      // 记录收到请求的原始信息
      this.ctx.emitter.emit('recvReq', req, res, this.ctx)

      // 身份认证
      let clientId, clientLabel
      if (this.ctx.auth) {
        try {
          const authRst = await this.ctx.auth.check(req, res)
          clientId = authRst.clientId
          clientLabel = authRst.clientLabel
          req.clientInfo = authRst.clientInfo
          req.headers['x-request-client'] = clientId
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "auth")
        } catch (err) {
          if (err.clientId) clientId = err.clientId
          if (err.clientId) req.headers['x-request-client'] = clientId
          if (err.clientInfo) req.clientInfo = err.clientInfo
          if (err.clientLabel) clientLabel = err.clientLabel
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "auth", err)
          res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end(err.msg)
        }
      }

      // 匹配路由
      let target = this.rules.match(targetRule, clientLabel)
      if (!target) {
        // 没有匹配的目标直接返回
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('Not found target')
      } else {
        req.targetUrl = target + req.url
        req.targetUrlObj = _.pick(_url.parse(req.targetUrl, true), [
          'protocol',
          'hostname',
          'port',
          'pathname',
          'query'
        ])
      }

      // 检查配额
      if (this.ctx.quota && clientId) {
        try {
          await this.ctx.quota.check(req)
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "quota")
        } catch (err) {
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "quota", err)
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end(err.msg)
        }
      }

      // 代理参数
      let proxyOptions = {}

      // 请求拦截器
      if (this.ctx.transformRequest) {
        try {
          const rst = await this.ctx.transformRequest.check(clientId, req)
          if (rst.target) target = rst.target
          if ('POST' === req.method && rst.rawBody && typeof rst.rawBody === "string") {
            req.rawBody = rst.rawBody
            req.headers["content-length"] = Buffer.byteLength(req.rawBody)
            proxyOptions.buffer = streamify([req.rawBody])
          }
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "transformRequest")
        } catch (err) {
          this.ctx.emitter.emit('checkpointReq', req, res, this.ctx, "transformRequest", err)
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end(err.msg)
        }
      }
      // 响应拦截器
      if (this.ctx.transformResponse) {
        proxyOptions.selfHandleResponse = true
      }
      
      // 执行反向代理
      proxyOptions.target = target
      proxy.web(req, res, proxyOptions)

      // 复制请求
    })
    app.listen(this.port, () => {
      logger.info('Tms Api Gateway is runing at %d', this.port)
    })
  }
  /**
   * controllers
   */
  createAPI() {
    if (!this.ctx.API) {
      return 
    }
    const APIContent = this.ctx.API
    const APIConfig = APIContent.config
    const metricsPrefix = _.get(APIConfig, "router.metrics.prefix", null)
    const ctrPrefix = _.get(APIConfig, "router.controllers.prefix", null)

    const parseBody = (req) => {
      return new Promise((resolve, reject) => {
        let body = ''
        req.on('data', chunk => {
          body += chunk
        })
        req.on('end', () => {
          resolve(body)
        })
      })
    }

    const app = http.createServer(async (req, res) => {
      const getUrl = new URL(req.url, "http://" + req.headers.host)
      req.path = getUrl.pathname
      if (req.method === "POST") {
        req.body = await parseBody(req)
        if (req.headers["content-type"] && req.headers["content-type"].indexOf("application/json") !== -1) {
          req.body = JSON.parse(req.body)
        }
      }

      if (metricsPrefix !== null && req.path.indexOf(metricsPrefix) === 0) {
        if (!this.ctx.API || !this.ctx.API.metrics) { // 需要检查热更新时是否是否关闭API，所以需要用this.ctx.API
          res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end('未开启监控服务')
        }

        const metrics = await this.ctx.API.metrics.register.metrics()
        return res.end(metrics)
      } else if (ctrPrefix !== null && req.path.indexOf(ctrPrefix) === 0) {
        if (!this.ctx.API || !this.ctx.API.controllers) { // 需要检查热更新时是否是否关闭API，所以需要用this.ctx.API
          res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end('未开启接口服务')
        }

        await this.ctx.API.controllers.fnCtrl(req, res)

        if (!res.hasHeader('Content-Type')) res.setHeader("Content-Type", "application/json;charset=utf-8")
        if (!res.body) res.body = ""
        if (typeof res.body !== "string") res.body = JSON.stringify(res.body)
        return res.end(res.body)
      } else {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('未支持的服务')
      }
    })

    let ctrlPort = APIConfig.port
    app.listen(ctrlPort, () => {
      logger.info('Tms Api Gateway-controller is runing at %d', ctrlPort)
    })
  }
}
Gateway.startup = async function() {
  try {
    const ctx = await Context.ins()
    const gateway = new Gateway(ctx)
    gateway.createGateway()
    gateway.createAPI()
  } catch (e) {
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
