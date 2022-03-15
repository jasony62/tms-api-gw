
const  crypto = require( 'crypto' );
 

function encText(text, key, iv, inEncoding = "utf8", outEncoding = "hex", options = { upperCase: true }) {
  const algorithm = options.algorithm ? options.algorithm : 'aes-128-ctr'

  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let cipherChunk = cipher.update(text, inEncoding, outEncoding)
  cipherChunk += cipher.final(outEncoding)
  
  let rst = cipherChunk.toString()
  if (options.upperCase === true) {
    rst = rst.toUpperCase()
  }

  return rst
}

function decText(cipherChunk, key, iv, inEncoding = "hex", outEncoding = "utf8", options = {}) {
  const algorithm = options.algorithm ? options.algorithm : 'aes-128-ctr'

  const decipher = crypto.createDecipheriv(algorithm, key, iv)

  let plainChunk = decipher.update(cipherChunk, inEncoding, outEncoding)
  plainChunk += decipher.final(outEncoding)

  return plainChunk
}

module.exports.encText = encText
module.exports.decText = decText