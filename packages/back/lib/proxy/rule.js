/**
 * This is a constructor for a HttpProxyRules instance.
 * @param {Object} ctx Takes in a `rules` obj, (optional) `default` target
 */
function HttpProxyRules(ctx) {
  this.ctx = ctx
  this.proxy = ctx.config.proxy

  return this
}

/**
 * 匹配对应的转发规则
 */
HttpProxyRules.prototype.getTargetRules = async function (req) {
  let rules = this.proxy.rules
  let path = req.url
  let pathPrefixRe
  let testPrefixMatch
  let urlPrefix
  let pathEndsWithSlash
  let targetRule
  let newReqUrl

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
      newReqUrl = path.replace(urlPrefix, '')
      targetRule = rules[pathPrefix]
      if (typeof targetRule === 'string') {
        targetRule = { target: targetRule }
      }
      break
    }
  }

  // 短链接
  if (!targetRule && this.ctx.API && this.ctx.API.controllers) {
    const { prefix: shorturl_prefix, host: shorturl_host } =
      this.ctx.API.controllers.config.shorturl
    let url = path.substring(0, path.lastIndexOf('/'))
    if (url === shorturl_prefix) {
      const urlObj = new URL(path, 'http://' + req.headers.host)
      targetRule = await this.ctx.API.controllers.shorturl_decode(
        urlObj.pathname
      )
      if (targetRule) {
        targetRule.target = targetRule.target_url
        newReqUrl = urlObj.search
        urlPrefix = shorturl_prefix
      }
    }
  }

  return { targetRule, urlPrefix, originUrl: path, newReqUrl }
}

/**
 * This function will modify the `req` object if a match is found.
 * We also return the new endpoint string if a match is found.
 * @param  {Object} req Takes in a `req` object.
 */
HttpProxyRules.prototype.match = function match(
  targetRule,
  clientLabel = null
) {
  let target = null

  if (Object.prototype.toString.call(targetRule) !== '[object Object]')
    return target

  if (Array.isArray(targetRule.target)) {
    for (let tg of targetRule.target) {
      if (tg.default === true) target = tg.url

      if (clientLabel && tg.label === clientLabel) {
        target = tg.url
        break
      }
    }
  } else if (typeof targetRule.target === 'string') {
    target = targetRule.target
  }

  return target
}

module.exports = HttpProxyRules
