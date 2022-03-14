const { encText, decText } = require("./js_ase")


const key = ("pduTl8r17FQoAMQp");  //十六位十六进制数作为密钥
const iv = ("aduTl4r17FSoHMQp");   //十六位十六进制数作为密钥偏移量
const srcs = ("19168530314");

const rst = encText(srcs, key, iv)
const rst2 = decText(rst, key, iv)

console.log(rst, rst2)