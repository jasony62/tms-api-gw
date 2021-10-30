const { encText, decText } = require("../transformResponse/js_ase")

const key = process.env.PINGAN_JIAMI_KEY || "pduTl8r17FQoAMQp";  //十六位十六进制数作为密钥
const iv = process.env.PINGAN_JIAMI_IV || "aduTl4r17FSoHMQp";   //十六位十六进制数作为密钥偏移量

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
    for (let v of body) {
      if (v.numberA) v.numberA = decText(v.numberA, key, iv)
    }
  }

  returData.rawBody = JSON.stringify(body)
  return Promise.resolve(returData)
}