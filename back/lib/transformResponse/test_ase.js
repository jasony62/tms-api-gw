module.exports = function(req, returnData) {
  let {statusCode, headers, body} = returnData

  body = JSON.parse(body)
  if (Array.isArray(body)) {
    body.push("test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test11")
  } else {
    body.testtesttest = "test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test11"
  }
  body = JSON.stringify(body)
  
  headers.test = "testtest"
  headers["content-length"] = Buffer.byteLength(body)

  Object.assign(returnData, {
    statusCode: 201,
    body
  })

  return returnData
}