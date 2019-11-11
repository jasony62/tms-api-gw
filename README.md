# tms-api-gw

注意不要保存

> cnpm i log4js

# docker

## mongodb

> docker pull mongo

```
docker run --name tms-api-gw -p 27017:27017 -v $PWD/storage/mongodb:/data/db -d mongo:latest
```

> docker pull redis:latest

基于 nodejs 的 http-proxy 实现的通用 api 网关。

请求管理流程

事件

接收 receive

记录原始数据（raw）

路由匹配（route）

若不匹配，返回 404

若匹配，match，生成路由匹配事件

用户认证（auth）

若不匹配，返回 401

若匹配，authorized，生成用户匹配队列

配额检查

若不通过，返回 403

若通过，passed，放入队列

通过代理发送请求

返回结果，放入队列

返回调用方法

# 配置文件

# 路由

ProxyRule

超时

报错

# 日志

保存在 mongodb 中

支持发送到 redis 或 kafka 中

配额管理

# 认证

到 redis 里取

# 配额
