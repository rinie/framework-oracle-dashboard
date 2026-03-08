// observablehq.config.js
export default {
  root: "framework/docs",
  title: "Oracle Dashboard",
  pages: [
    {
      name: "Sales",
      pages: [
        { name: "Summary", path: "/sales-summary" }
      ]
    }
    // To add more sections:
    // {
    //   name: "Section name",
    //   pages: [
    //     { name: "Page name", path: "/page-path" }
    //   ]
    // }
  ],
  // No proxy needed. In dev the browser fetches data directly from the sidecar (port 3001, CORS enabled).
  // In production, put a reverse proxy in front so /data is on the same origin as the framework.
};
