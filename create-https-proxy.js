const https = require('https');
const http = require('http');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/smart.aimaven.top/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/smart.aimaven.top/fullchain.pem')
};

const targetPort = 8080;

http.createServer((req, res) => {
  // 重定向HTTP到HTTPS
  const host = req.headers.host || 'smart.aimaven.top';
  res.writeHead(301, {
    'Location': `https://${host}${req.url}`
  });
  res.end();
}).listen(80, () => {
  console.log('HTTP server listening on port 80');
});

https.createServer(options, (req, res) => {
  // 代理到本地8080端口
  const proxyReq = http.request({
    host: 'localhost',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  req.pipe(proxyReq);
}).listen(443, () => {
  console.log('HTTPS server listening on port 443');
});

