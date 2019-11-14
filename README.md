# tms-api-gw

tms-api-gw 是一个 api 网关，可以通过设置规则将外部 http 请求转发到内部服务，提供：路由、日志、认证、配额功能。

# 安装

> cnpm i

> cnpm i log4js

# 业务规则

在 config 目录下新建 gateway.js 文件，参考 gateway.sample.js 文件进行设置。

## 路由规则（proxy.rules）

参考：https://www.npmjs.com/package/http-proxy-rules

## 日志（trace）

指定连接 mongodb 的参数。

包括如下 collection：

| 集合          | 用途               |
| ------------- | ------------------ |
| trace_log     | api 调用的完整数据 |
| quota_day     | api 调用每日计数   |
| quota_archive | api 调用计数归档   |

## 认证（auth）

请求中包含参数`access_token`，网关将该参数转拼接到 url 发送到 url 指定的认证服务接口。认证服务并不是本项目的组成部分，需要单独实现。

| 参数       | 类型   | 说明                                                                                                                               |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| http.query | array  | 第 1 位指定接收到的 url 中认证信息字段的名称，第 2 位认证服务接口中认证信息字段的名称，若不指定为：['access_token','acccess_token] |
| http.url   | string | 指定的认证服务接口                                                                                                                 |

## 配额（quota）

未实现

# 运行

> docker-compose up -d
