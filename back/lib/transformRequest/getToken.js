module.exports = function(clientId, req, target) {
  let headers = req.headers
  const Authorization = headers["authorization"]
  const [appkey, secret] = Buffer.from(Authorization.substr("Basic ".length), "base64").toString("UTF-8").split(":")
  delete headers["authorization"]
  headers["content-type"] = "application/json; charset=utf-8"
  
  // const url = new URL(req.url, "http://localhost")
  // url.searchParams.set("appkey", appkey)
  // url.searchParams.set("secret", secret)
  // console.log(123, url)
  if (req.url.indexOf("?") === -1) {
    req.url += "?"
  } else {
    req.url += "&"
  }

  req.url += `appkey=${appkey}&secret=${secret}`
  req.headers = headers

  return { }
}