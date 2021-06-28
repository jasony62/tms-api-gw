module.exports = function(clientId, req, target) {
  
  if (req.clientInfo && req.clientInfo.data && req.clientInfo.data.cust_id) 
    req.headers["x-request-custid"] = req.clientInfo.data.cust_id
  else return Promise.reject({msg: "未找到custid"})

  return Promise.resolve({ })
}