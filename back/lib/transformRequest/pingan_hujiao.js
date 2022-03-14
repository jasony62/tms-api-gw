const _ = require("lodash")
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

  let url = require('url').parse(req.originUrl).pathname
  let urlArr = url.split("/")
  let funcName = urlArr.slice(-1)[0]

  if (funcName === "selectNum") {
    if (process.env.PINGAN_CUSTID_PATH && process.env.PINGAN_CUSTID_VALUE && _.get(req.clientInfo, process.env.PINGAN_CUSTID_PATH) === process.env.PINGAN_CUSTID_VALUE) {
      if (Array.isArray(body)) {
        for (let v of body) {
          if (v.numberA) {
            try {
              v.numberA = decText(v.numberA, key, iv)
              if(!(new RegExp(/^\d+$/).test(v.numberA))) return Promise.reject({msg: `解密失败(${v.numberA})`})
            } catch (error) {
              return Promise.reject({msg: `解密失败(${v.numberA})`})
            }
          }
        }
      }
    }
  } else if (funcName === "deleteNum") {
    if (process.env.PINGAN_CUSTID_PATH && process.env.PINGAN_CUSTID_VALUE && _.get(req.clientInfo, process.env.PINGAN_CUSTID_PATH) === process.env.PINGAN_CUSTID_VALUE) {
      if (Object.prototype.toString.call(body) === '[object Object]') {
        if (body.numberA) {
          try {
            body.numberA = decText(body.numberA, key, iv)
            if(!(new RegExp(/^\d+$/).test(body.numberA))) return Promise.reject({msg: `解密失败(${body.numberA})`})
          } catch (error) {
            return Promise.reject({msg: `解密失败(${body.numberA})`})
          }
        }
        if (body.numberX) {
          try {
            body.numberX = decText(body.numberX, key, iv)
            if(!(new RegExp(/^\d+$/).test(body.numberX))) return Promise.reject({msg: `解密失败(${body.numberX})`})
          } catch (error) {
            return Promise.reject({msg: `解密失败(${body.numberX})`})
          }
        }
      }
    }
  }

  returData.rawBody = JSON.stringify(body)
  return Promise.resolve(returData)
}