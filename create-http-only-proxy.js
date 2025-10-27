const http = require('http');

const targetPort = 8080;

// 只提供HTTP服务，Cloudflare会处理HTTPS终止
http.createServer((req, res) => {
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
}).listen(80, () => {
  console.log('HTTP proxy server listening on port 80');
  console.log('Cloudflare will handle HTTPS termination');
});

