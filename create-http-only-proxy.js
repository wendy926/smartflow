const http = require('http');

const targetPort = 8080;

// 只提供HTTP服务，Cloudflare会处理HTTPS终止
// 监听所有IPv4和IPv6地址
const server = http.createServer((req, res) => {
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
});

// 同时监听IPv4和IPv6
server.listen(80, '0.0.0.0', () => {
  console.log('HTTP proxy server listening on port 80 (IPv4 and IPv6)');
  console.log('Cloudflare will handle HTTPS termination');
});

