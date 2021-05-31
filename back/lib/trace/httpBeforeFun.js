const _ = require("lodash")

module.exports = function(req, event, clientId, headers = {}, data) {
  if (req.clientObj) headers["x-request-client"] = process.env.YZ_CLIENTID ? _.get(req.clientObj, process.env.YZ_CLIENTID, "") : req.clientObj.data.custId

  if (process.env.TMS_APP_NAME_URLPREFIX) {
    const urlPrefix = JSON.parse(process.env.TMS_APP_NAME_URLPREFIX)
    if (urlPrefix[req.urlPrefix]) {
      headers["x-gateway-name"] = urlPrefix[req.urlPrefix]
    }
  }
  if (!headers["x-gateway-name"] && process.env.TMS_APP_NAME) {
    headers["x-gateway-name"] = process.env.TMS_APP_NAME
  }
}