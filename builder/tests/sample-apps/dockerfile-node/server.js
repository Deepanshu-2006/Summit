const http = require('http');

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'dockerfile-node' }));
});

server.listen(port, () => {
  console.log(`dockerfile-node server running on port ${port}`);
});
