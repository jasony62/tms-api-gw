module.exports = function(req){
  return {
    rateLimit: {
      minute: {
        limit: process.env.TMS_QUOTA_RATELIMIT_MINUTE_TEST
      }
    }
  }
}