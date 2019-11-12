const redis = require('redis')

class RedisContext {}

RedisContext.ins(function() {
  const instances = new Map()
  return function(redisConfig) {
    if (instance) return instance

    return instance
  }
})()
module.exports = RedisContext
