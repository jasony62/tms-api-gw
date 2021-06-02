// 服务商网关

const axios = require('axios')
/**
 * 获得请求中传递的access_token
 *
 * @param {*} request
 */
function getAccessTokenByRequest(request) {
  let access_token
  let { authorization } = request.headers
  if (authorization && authorization.indexOf('Bearer') === 0) {
    access_token = authorization.match(/\S+$/)[0]
  } else if (request.query.access_token) {
    access_token = request.query.access_token
  } else {
    return [false, {code: "20003", msg: '缺少Authorization头或access_token参数'}]
  }

  return [true, access_token]
}

module.exports =function (req, res, redundancyOptions) {
  const { query } = require('url').parse(req.url, true)
  let access_token = getAccessTokenByRequest({ headers: req.headers, query })
  if (access_token[0] === false) return Promise.reject(access_token[1])
  access_token = access_token[1]
  return axios.get(`${process.env.TMS_AUTH_HTTPSER_URL || process.env.TMS_AUTH_HTTP_URL}?access_token=${access_token}`).then(rsp => {
    if (rsp.data.code !== 0) {
      return rsp.data
    }

    const client = rsp.data.result
    req.clientObj = client
    redundancyOptions.client = client

    const clientId = client.data.uid
    return { code: 0, clientId }
  })
}