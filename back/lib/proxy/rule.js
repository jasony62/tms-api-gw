/**
 * This is a constructor for a HttpProxyRules instance.
 * @param {Object} ctx Takes in a `rules` obj, (optional) `default` target
 */
function HttpProxyRules(ctx) {
  this.rules = ctx.config.proxy.rules
  this.default = ctx.config.proxy.default || null
  this.API = ctx.API

  return this
}

/**
 * This function will modify the `req` object if a match is found.
 * We also return the new endpoint string if a match is found.
 * @param  {Object} req Takes in a `req` object.
 */
HttpProxyRules.prototype.match = async function match(req) {
  let rules = this.rules
  let target = this.default
  let path = req.url

  // go through the proxy rules, assuming keys (path prefixes) are ordered
  // and pick the first target whose path prefix is a prefix of the
  // request url path. RegExp enabled.
  let pathPrefixRe
  let testPrefixMatch
  let urlPrefix
  let pathEndsWithSlash
  let targetRule
  for (let pathPrefix in rules) {
    if (!rules.hasOwnProperty(pathPrefix)) continue
    if (pathPrefix[pathPrefix.length - 1] === '/') {
      pathPrefixRe = new RegExp(pathPrefix)
      pathEndsWithSlash = true
    } else {
      // match '/test' or '/test/' or './test?' but not '/testing'
      // \W 匹配一个非单字字符。等价于 [^A-Za-z0-9_]。
      // (?:x) 匹配 'x' 但是不记住匹配项。
      pathPrefixRe = new RegExp('(' + pathPrefix + ')' + '(?:\\W|$)')
      pathEndsWithSlash = false
    }
    testPrefixMatch = pathPrefixRe.exec(path)
    if (testPrefixMatch && testPrefixMatch.index === 0) {
      urlPrefix = pathEndsWithSlash ? testPrefixMatch[0] : testPrefixMatch[1]
      req.url = path.replace(urlPrefix, '')
      targetRule = rules[pathPrefix]
      if (typeof targetRule === "string") {
        target = targetRule
        targetRule = { target }
      } else {
        target = targetRule.target
      }
      // We replace matches on the target,
      // e.g. /posts/([0-9]+)/comments/([0-9]+) => /posts/$1/comments/$2
      for (var i = 1; i < testPrefixMatch.length; i++) {
        target = target.replace(
          '$' + i,
          testPrefixMatch[i + (pathEndsWithSlash ? 0 : 1)]
        )
      }
      break
    }
  }

  // 短链接 
  if (!targetRule && this.API) {
    const { prefix: shorturl_prefix, host: shorturl_host } = this.API.config.shorturl
    let url = path.substring(0, path.lastIndexOf("/"))
    if (url === shorturl_prefix) {
      const urlObj = new URL(path, "http://" + req.headers.host)
      targetRule = await this.API.shorturl_decode(urlObj.pathname)
      if (targetRule) {
        req.url = urlObj.search
        target = targetRule.target_url
        urlPrefix = shorturl_prefix
      }
    }
  }

  req.targetRule = targetRule
  req.urlPrefix = urlPrefix
  req.originUrl = path
  req.targetUrl = target + req.url

  return target
}

module.exports = HttpProxyRules
