#基于alpine的nodejs基础镜像
FROM node:12.10.0-alpine AS builder
#MAINTAINER made nodejs by p21 from lit29@chinatelecom.cn
WORKDIR /usr/src/app
#Install dependencied of nodejs on alpine
RUN npm install -g cnpm --registry=https://registry.npm.taobao.org
#Install node_modules
COPY ./package.json ./
RUN cnpm install --production
#拉包
FROM node:12.10.0-alpine
WORKDIR /usr/src/app
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories
RUN apk update && apk add bash tzdata \
  && cp -r -f /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
COPY --from=builder /usr/src/app/node_modules node_modules
#copy code && config port  && start 
COPY . .
EXPOSE 3000
CMD [ "node", "./app.js" ]
