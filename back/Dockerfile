FROM node:alpine

RUN npm install cnpm -g

WORKDIR /usr/src/app

COPY package*.json ./

RUN cnpm install --production \
  && cnpm install log4js

COPY . .

RUN mkdir config

ENV TMS_API_GW_ENV='docker'

EXPOSE 3000

CMD [ "node", "./app.js" ]