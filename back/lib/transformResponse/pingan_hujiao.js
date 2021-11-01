const _ = require("lodash")
const { encText, decText } = require("../transformResponse/js_ase")

const key = process.env.PINGAN_JIAMI_KEY || "pduTl8r17FQoAMQp";  //十六位十六进制数作为密钥
const iv = process.env.PINGAN_JIAMI_IV || "aduTl4r17FSoHMQp";   //十六位十六进制数作为密钥偏移量


module.exports = async function(req, returnData) {
  let {statusCode, headers, body} = returnData

  body = JSON.parse(body)

  let url = require('url').parse(req.originUrl).pathname
  let urlArr = url.split("/")
  let funcName = urlArr.slice(-1)[0]

  if (funcName === "selectNum") {
    if (process.env.PINGAN_GETCUSTID_PATH && process.env.PINGAN_CUSTID_VALUE && _.get(req.clientInfo, process.env.PINGAN_CUSTID_PATH) === process.env.PINGAN_GETCUSTID_VALUE) {
      if (body.returnCode == "0") {
        if (body.resBody && body.resBody.toMongoList) {
          let toMongoList = body.resBody.toMongoList
          if (Array.isArray(toMongoList)) {
            for (let v of toMongoList) {
              if (v.numberA) v.numberA = encText(v.numberA, key, iv)
              if (v.numberX) v.numberX = encText(v.numberX, key, iv)
            }
          }
        }
      }
    }
  } else if (funcName === "deleteNum") {
    if (process.env.PINGAN_GETCUSTID_PATH && process.env.PINGAN_CUSTID_VALUE && _.get(req.clientInfo, process.env.PINGAN_CUSTID_PATH) === process.env.PINGAN_GETCUSTID_VALUE) {
      if (body.returnCode == "0") {
        if (body.resBody && Array.isArray(body.resBody)) {
          let resBody = body.resBody
          for (let v of resBody) {
            if (v.numberA) v.numberA = encText(v.numberA, key, iv)
            if (v.numberX) v.numberX = encText(v.numberX, key, iv)
          }
        }
      }
    }
  }

  body = JSON.stringify(body)
  
  headers["content-length"] = Buffer.byteLength(body)
  returnData.body = body

  return returnData
}