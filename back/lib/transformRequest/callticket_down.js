module.exports = function(clientId, req) {
  
  if (req.clientInfo && req.clientInfo.data && req.clientInfo.data.cust_id) 
    req.headers["x-request-client"] = req.clientInfo.data.cust_id

  return { }
}