const ProxyRule = require('@/lib/proxy/rule')
describe('#proxy/rule', () => {
  it('rule', () => {
    let target = 'http://localhost:8080/cool'
    let proxyRule = new ProxyRule({
      rules: {
        '/test': target
      }
    })
    let req = { url: '/test' }
    let matched = proxyRule.match(req)
    expect(matched).toBe(target)
  })
})
