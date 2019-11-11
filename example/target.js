var http = require('http')
var PORT = 1234
var app = http.createServer(function(req, res) {
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
app.listen(PORT, function() {
  console.log('server is runing at %d', PORT)
})
