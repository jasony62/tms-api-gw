let port, ctrlPort
port = parseInt(process.env.TMS_APP_PORT) || 3000 // 客户访问的端口
ctrlPort = parseInt(process.env.TMS_APP_CTRLPORT) || 3457  // 内部人员生产短链接接口的端口号

module.exports = {
  port,
  trace: { // 日志
    enable: true,
    mongodb: {
      type: "mongodb",
      // --------start------------ 日志的mongodb
      user: "root",  
      password: "Ctsi5G2021",
      host: "localhost",
      port: 27017,
      database: "gw5g",
      maxPoolSize: 10,
      // ---------end-----------
    },
    default: ["mongodb"]
  },
  quota: {
    enable: true,
    mongodb: {
      // -------------start------------------  配额（访问情况统计） 的mongodb
      user: "root",  
      password: "Ctsi5G2021",
      host: "localhost",
      port: 27017,
      database: "gw5g",
      maxPoolSize: 10,
      // ---------------end----------------
    },
    default: []
  },
  API: {
    enable: true,
    port: ctrlPort,
    router: {
      controllers: {
        // ------------start------------------- 调用网关接口时的前缀
        prefix: "/gw/api" 
        // --------------end-----------------
      },
    },
    controllers: {
      enable: true,
      mongodb: {
        // -------------start------------------ 储存短链接的mongodb
        user: "root",  
        password: "Ctsi5G2021",
        host: "localhost",
        port: 27017,
        database: "gw5g",
        maxPoolSize: 10,
        // --------------end-----------------
      },
      shorturl: {
        // -------------start------------------生成的短链接的域名、前缀
        host: process.env.TMS_APP_SHORTURL_HOST || "http://192.168.0.41",
        prefix: process.env.TMS_APP_SHORTURL_PREFIX || "/gw/i"
        // --------------end-----------------
      }
    },
  },
}
