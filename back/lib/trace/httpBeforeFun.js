module.exports = function(req, event, clientId, headers, data) {
  if (process.env.TMS_APP_NAME) headers["x-gateway-name"] = process.env.TMS_APP_NAME
}