
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
    })
    req.on('end', () => {
      resolve(body)
    })
  })
}
module.exports = async function(clientId, req, returData) {
  if (req.method !== "POST") return Promise.resolve({})

  let body
  if (returData.rawBody) {
    body = returData.rawBody
  } else body = await parseBody(req)

  body = JSON.parse(body)
  if (Array.isArray(body)) {
    body.push("test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test11")
  } else {
    body.testtesttest = "test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test,test11"
  }

  returData.rawBody = JSON.stringify(body)
  return returData
}