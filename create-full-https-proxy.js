const https = require('https');
const http = require('http');
const fs = require('fs');

const targetPort = 8080;

// SSL证书路径
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/smart.aimaven.top/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/smart.aimaven.top/fullchain.pem')
};

// HTTP服务器（重定向到HTTPS）
http.createServer((req, res) => {
  const host = req.headers.host || 'smart.aimaven.top';
  res.writeHead(301, { 'Location': `https://${host}${req.url}` });
  res.end();
}).listen(80, '0.0.0.0', () => {
  console.log('HTTP server listening on port 80 (redirecting to HTTPS)');
});

// HTTPS服务器
https.createServer(sslOptions, (req, res) => {
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
}).listen(443, '0.0.0.0', () => {
  console.log('HTTPS server listening on port 443');
  console.log('SSL certificate loaded from Let\'s Encrypt');
});

