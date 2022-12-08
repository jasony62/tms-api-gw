# 服务预编译
FROM node:16.15-alpine3.15 AS builder

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories

# 修改npm源
RUN npm config set registry https://registry.npmmirror.com

# 安装基础包
RUN npm install --location=global pnpm

WORKDIR /usr/src/app

#Install node_modules
COPY ./package.json ./
RUN pnpm install --production

#拉包
FROM node:16.15-alpine3.15
WORKDIR /usr/src/app

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories
RUN apk update && apk add bash tzdata \
  && cp -r -f /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

COPY --from=builder /usr/src/app/node_modules node_modules
#copy code && config port  && start 
COPY . .

COPY ./config/gateway.js /usr/src/app/config/gateway.js
COPY ./config/log4js.sample.js /usr/src/app/config/log4js.js

CMD [ "node", "./app.js" ]
