module.exports = function(req, event, clientId, headers = {}, data) {
  if (req.clientObj) headers["x-request-client"] = process.env.YZ_CLIENTID ? req.clientObj[process.env.YZ_CLIENTID] : req.clientObj.data.custId
  if (process.env.TMS_APP_NAME) headers["x-gateway-name"] = process.env.TMS_APP_NAME
}