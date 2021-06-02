module.exports = function(clientId, req, target, redundancyOptions) {
  
  if (redundancyOptions.client && redundancyOptions.client.data && redundancyOptions.client.data.cust_id) 
    req.headers["x-request-client"] = redundancyOptions.client.data.cust_id

  return { }
}