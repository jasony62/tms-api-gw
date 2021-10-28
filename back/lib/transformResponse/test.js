
module.exports = async function(req, statusCode, headers, body) {
  let body2 = '{"code":200,"message":"操作成功2sadad 阿萨22222222","data":null}'
  let headers2 = {'content-length': Buffer.byteLength(body2)}
  let headers3 = Object.assign({}, headers, headers2)
console.log(222333, statusCode, headers, body)
  return {statusCode: 401, headers: headers3, body: body2}
  // return {statusCode: statusCode, headers: headers, body: body}
}