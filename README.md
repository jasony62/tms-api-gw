# tms-api-gw

tms-api-gw 是一个 api 网关，可以通过设置规则将外部 http 请求转发到内部服务，提供：路由、日志、认证、配额功能。

# 安装

> cnpm i

> cnpm i log4js

# 启动

> node app.js

# 业务规则

在 config 目录下新建 gateway.js 文件，参考 gateway.sample.js 文件进行设置，gateway.local.js 为本地配置文件，其中的参数会覆盖gateway.js。

## 路由规则（proxy.rules）

```
Set up proxy rules instance
let proxyRules = new HttpProxyRules({
  rules: {
    '.*/test': 'http://localhost:8080/cool', // Rule (1)
    '.*/test2/': 'http://localhost:8080/cool2/', // Rule (2)
    '/posts/([0-9]+)/comments/([0-9]+)': 'http://localhost:8080/p/$1/c/$2', // Rule (3)
    '/author/([0-9]+)/posts/([0-9]+)/': 'http://localhost:8080/a/$1/p/$2/' // Rule (4)
    '/test3': {"target":"http://localhost/c2/d2","auth":["***"],"trace":["***"],"transformRequest":["***"]} // Rule (5)
    '/test2': [{"url":"http://localhost/c/d","label":"trial","default":true},{"url":"http://localhost/c2/d2","label":"official"}] // Rule (6)
  }
})
```

规则对象包含一组键-值对，它们将 regex 支持的 url 路径映射到目标路由。模块只尝试用访问的 url 路径，而不是整个 url，进行规则匹配。目标路由必须包含协议(如 http)和 FQDN。您可以在构造规则时使用捕获组 (e.g. '/posts/(\d+)/)。这种情况下，目标路径中的$1将被替换为来自第一个捕获组的值，$2 替换为第二个捕获组的值，依此类推。

参考：https://www.npmjs.com/package/http-proxy-rules

## 日志（trace）

指定连接 mongodb 的参数。

包括如下 collection：

| 集合      | 用途               |
| --------- | ------------------ |
| trace_log | api 调用的完整数据 |

## 认证（auth）

请求中包含参数`access_token`，网关将该参数转拼接到 url 发送到 url 指定的认证服务接口。认证服务并不是本项目的组成部分，需要单独实现。

| 参数       | 类型   | 说明                                                                                                                               |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| http.query | array  | 第 1 位指定接收到的 url 中认证信息字段的名称，第 2 位认证服务接口中认证信息字段的名称，若不指定为：['access_token','acccess_token] |
| http.url   | string | 指定的认证服务接口                                                                                                                 |

## 配额（quota）

指定连接 mongodb 的参数。

包括如下 collection：

| 集合            | 用途                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| counter_day     | 记录用户（clientId）最后一次（latestAt）调用某 api 时，所在分（minute），小时（hour）和天（day）的累计调用次数。一个 clientId 和 api 的组合只记录 1 条数据。 |
| counter_archive | 记录用户（clientId）在某年（year），某月（month），某日（day）的调用某 api 的累计次数。一个 clientId 和 api 的组合在每次发生调用的天产生 1 条数据。          |

配额控制功能
```
  quota: {
    enable: true,
    mongodb: {
      host,
      port: 27017,
      database: 'tms-api-gw'
    },
    rule_test: "./lib/quota/test.js", //支持指定方法返回  {itemId:"/api/a:123",rateLimit:{rate: "0 * * * * ?",limit: 0},attachedField:{custid:"123"}}
    statistical_Day: {
      type: "object",
      item: {
        custid: "headers.x-request-client",
        api: "originUrlObj.pathname"
      },
      rateLimit: {
        // rate: '0 * * * * ?',
        rate: null,
        limit: 0
      }
    },
    http_test: {
      type: "http",
      url: "http://localhost/api",
      parameter: {
        url: "originUrl",
        headers: "headers",
        client: "clientInfo"
      },
      itemIdField: "result.0.id",
      rateLimitField: "result.0.rateLimit",
      attachedField: "result.0.attachedField"
    },
    default: ["statistical_Day"]
  },
```
##  API 服务

tms-api-gw 管理端，需要另起端口，支持自定义接口，以及为Prometheus提供指标

# 配置文件热更新

如果需要更新配置文件但不想重启服务，可以通过更改gateway.js 或 gateway.local.js ，然后调用API http://localhost:3457/admin/hotUpdate/config
即可。（需开启API服务、API-接口服务。暂支持转发规则的修改，以及认证、配额、日志登服务的关闭操作）

# 运行示例

复制`config/gateway.sample.js`为`config/gateway.js`，可以根据需要指定端口。

启动容器

> docker-compose up

执行示例

> node ./example/target.js 1234

> ./example/get

> ./example/post

进入 mongo 容器查看数据

> docker exec -it tms-api-gw-mongo /bin/bash

关闭容器

> docker-compose down
