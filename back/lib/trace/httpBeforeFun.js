const _ = require("lodash")

module.exports = function(req, event, clientId, headers = {}, data) {
  if (req.clientObj) headers["x-request-client"] = process.env.YZ_CLIENTID ? _.get(req.clientObj, process.env.YZ_CLIENTID, "") : req.clientObj.data.custId

  if (process.env.TMS_YZ_GOODID) {
    const urlPrefix = JSON.parse(process.env.TMS_YZ_GOODID)
    const originUrl = _.pick(require('url').parse(req.originUrl, true), ['pathname'])
    if (urlPrefix[originUrl.pathname]) {
      headers["x-request-goodid"] = urlPrefix[originUrl.pathname]
    } else if (urlPrefix[req.urlPrefix]) {
      headers["x-request-goodid"] = urlPrefix[req.urlPrefix]
    }
  }
  if (process.env.TMS_APP_NAME) {
    headers["x-gateway-name"] = process.env.TMS_APP_NAME
  }
}