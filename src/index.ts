import express from "express";
import { createCreatorRouter } from "./admin/router.js";
import { TesseraSidecarClient } from "./sidecar-client.js";

export * from "./types.js";
export * from "./sidecar-client.js";
export * from "./middleware.js";
export { createCreatorRouter } from "./admin/router.js";

/**
 * Standalone server runner when mcp-plugin-tessera is executed directly.
 */
function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  return (
    process.argv[1].endsWith("index.js") ||
    process.argv[1].endsWith("index.ts")
  );
}

if (isMainModule()) {
  const PORT = parseInt(process.env.PORT || "4000", 10);
  const HOST = process.env.HOST || "0.0.0.0";
  const app = express();

  const client = new TesseraSidecarClient();
  app.use("/", createCreatorRouter(client));

  app.listen(PORT, HOST, () => {
    console.log(`\n======================================================`);
    console.log(` ? Tessera MCP Plugin - Creator Portal Running`);
    console.log(` ?? Open in browser: http://localhost:${PORT}/`);
    console.log(`======================================================\n`);
  });
}
