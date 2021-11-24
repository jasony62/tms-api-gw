const _ = require("lodash")

module.exports = function(req){

  const item = {
    custid: "custInfo.data.cust_id",
    api: "originUrlObj.pathname",
    numberA: "originUrlObj.query.access_token"
  }
  
  let items = []
  for (const itemKey in item) {
    items.push(_.get(req, item[itemKey], ""))
  }
  const itemId = items.join(":")

  return {
    itemId,
    rateLimit: {
      rate: "0 * * * * ?",
      limit: process.env.TMS_QUOTA_RATELIMIT_MINUTE_TEST || 0
    }
  }
}