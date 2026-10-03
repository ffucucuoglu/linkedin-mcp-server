#!/usr/bin/env node
// LinkFetch MCP server — stdio entrypoint. Configured via env vars:
//   LINKFETCH_API_KEY  (required) — Bearer token from the LinkFetch dashboard.
//   LINKFETCH_API_URL  (optional) — defaults to https://api.linkfetch.io.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "./client.js";
import { registerTools } from "./tools.js";

const DEFAULT_BASE_URL = "https://api.linkfetch.io";

async function main() {
  const apiKey = process.env.LINKFETCH_API_KEY?.trim();
  if (!apiKey) {
    // stderr only — stdout is reserved for the MCP stdio protocol.
    process.stderr.write(
      "linkfetch-mcp: LINKFETCH_API_KEY is not set. Get one at https://linkfetch.io/dashboard and set it in your MCP client config.\n",
    );
    process.exit(1);
  }

  const baseUrl = process.env.LINKFETCH_API_URL?.trim() || DEFAULT_BASE_URL;
  const client = createClient({ apiKey, baseUrl });

  const server = new McpServer({
    name: "linkfetch",
    version: "0.1.0",
  });

  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(
    `linkfetch-mcp: fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
