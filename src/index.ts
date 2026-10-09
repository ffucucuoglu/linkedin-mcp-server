#!/usr/bin/env node
// linkfetch-mcp: a stdio bridge to LinkFetch's hosted MCP server. Every
// tools/list and tools/call goes to https://linkfetch.io/mcp with your API key,
// so the tools, their descriptions and their prices are always the hosted ones.
//   LINKFETCH_API_KEY  (required) — lf_… key from https://linkfetch.io/app/mcp
//   LINKFETCH_MCP_URL  (optional) — defaults to https://linkfetch.io/mcp

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const VERSION = "0.1.3";
const KEYS_PAGE = "https://linkfetch.io/app/mcp";
// LinkFetch tools can page through LinkedIn or run AI over 25 records; give them time.
const CALL_TIMEOUT_MS = 5 * 60_000;

const apiKey = process.env.LINKFETCH_API_KEY?.trim() ?? "";
const url = new URL(process.env.LINKFETCH_MCP_URL?.trim() || "https://linkfetch.io/mcp");

// stderr only: stdout carries the MCP protocol.
const log = (msg: string) => process.stderr.write(`linkfetch-mcp: ${msg}\n`);

/** What to tell the user when the key is missing or rejected. */
function keyProblem(): string {
  if (!apiKey) return `LINKFETCH_API_KEY is not set. Create a key at ${KEYS_PAGE} and add it to this server's env in your MCP client config.`;
  if (apiKey.startsWith("sk_")) return `LINKFETCH_API_KEY is an old sk_… key, which stopped working when LinkFetch 2 launched. Create a new lf_… key at ${KEYS_PAGE} and replace it in your MCP client config.`;
  return `LinkFetch rejected LINKFETCH_API_KEY. Check it was copied in full, or create a new one at ${KEYS_PAGE}.`;
}

/** An error the SDK sends back as-is (McpError would prefix "MCP error -32600:", and the client adds it again). */
const rpcError = (code: ErrorCode, message: string) => Object.assign(new Error(message), { code });

let remote: Promise<Client> | null = null;

/** The connection to the hosted server, opened on first use and reopened after a failure. */
function connect(): Promise<Client> {
  if (!apiKey || apiKey.startsWith("sk_")) return Promise.reject(rpcError(ErrorCode.InvalidRequest, keyProblem()));
  remote ??= (async () => {
    const client = new Client({ name: "linkfetch-mcp", version: VERSION });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
    });
    await client.connect(transport);
    return client;
  })().catch((err: unknown) => {
    remote = null;
    const message = err instanceof Error ? err.message : String(err);
    if (/\b401\b|unauthori[sz]ed|-32001/i.test(message)) throw rpcError(ErrorCode.InvalidRequest, keyProblem());
    throw rpcError(ErrorCode.InternalError, `Could not reach LinkFetch at ${url.href}: ${message}`);
  });
  return remote;
}

async function main() {
  // Connect up front to pass the hosted server's instructions on to the client.
  // If that fails, still start: each request retries and reports the reason.
  const instructions = await connect()
    .then((c) => c.getInstructions())
    .catch((err: unknown) => {
      log(err instanceof Error ? err.message : String(err));
      return undefined;
    });

  const server = new Server({ name: "linkfetch", title: "LinkFetch", version: VERSION }, { capabilities: { tools: {} }, instructions });
  server.setRequestHandler(ListToolsRequestSchema, async (req) => (await connect()).listTools(req.params));
  server.setRequestHandler(CallToolRequestSchema, async (req) =>
    (await connect()).callTool(req.params, undefined, { timeout: CALL_TIMEOUT_MS }),
  );

  await server.connect(new StdioServerTransport());
}

main().catch((err: unknown) => {
  log(`fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});
