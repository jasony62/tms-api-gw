if (process.argv.length < 3) {
  console.log('请提供测试服务的端口')
  process.exit(0)
}

const http = require('http')
const port = process.argv[2]
const app = http.createServer((req, res) => {
  console.log('req.method', req.method)
  console.log('req.url', req.url)
  console.log('req.headers', req.headers)
  let body = ''
  req.on('data', chunk => {
    body += chunk
  })
  req.on('end', () => {
    console.log('body', body)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write('<h1>Hello</h1>')
    res.end()
  })
})
app.listen(port, function() {
  console.log('测试服务启动，端口：%d', port)
})
