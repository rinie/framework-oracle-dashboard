// observablehq.config.js
export default {
  title: "Oracle Dashboard",
  pages: [
    { name: "Sales Summary", path: "/sales-summary" }
  ],
  // Proxy WebSocket to sidecar in dev mode
  // In production, configure your reverse proxy to forward /data -> sidecar:3001/data
  proxy: [
    { path: "/data", target: "ws://localhost:3001" }
  ]
};
