"use strict";

const http = require("http");

const listenPort = Number(process.env.PORT || 3000);
const shopPort = Number(process.env.SHOP_INTERNAL_PORT || 3001);

function isHealth(url) {
  const path = (url || "/").split("?")[0];
  return path === "/api/health" || path === "/healthz";
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && isHealth(req.url || "/")) {
    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end('{"ok":true}');
    return;
  }

  const proxy = http.request(
    {
      hostname: "127.0.0.1",
      port: shopPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    },
  );
  proxy.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("shop unavailable");
  });
  req.pipe(proxy);
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log(`[proxy] :${listenPort} -> shop :${shopPort}`);
});
