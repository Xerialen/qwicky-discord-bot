const http = require('http');

function startHealthServer(client, port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const isReady = client.isReady();
      const status = isReady ? 200 : 503;

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isReady ? 'ok' : 'not_ready',
        uptime: process.uptime(),
        bot_ready: isReady,
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`[Health] Server listening on port ${port}`);
  });

  return server;
}

module.exports = { startHealthServer };
