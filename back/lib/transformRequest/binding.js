module.exports = function(clientId, req, target, redundancyOptions) {
  
  if (redundancyOptions.client && redundancyOptions.client.data && redundancyOptions.client.data.cust_id) 
    req.headers["x-request-custid"] = redundancyOptions.client.data.cust_id
  else return Promise.reject({msg: "未找到custid"})

  return Promise.resolve({ })
}