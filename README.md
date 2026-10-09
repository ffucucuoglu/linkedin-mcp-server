# LinkedIn MCP server for Claude, Cursor and any AI agent

<!-- mcp-name: io.linkfetch/linkedin -->

[![npm](https://img.shields.io/npm/v/linkfetch-mcp)](https://www.npmjs.com/package/linkfetch-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-io.linkfetch%2Flinkedin-black)](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.linkfetch/linkedin)

`linkfetch-mcp` gives any AI agent a full set of LinkedIn tools: search every public LinkedIn job since April 2026, look up companies, score and sort them with AI functions, and, through a LinkedIn account you connect, search people and posts, read profiles and your inbox, and send messages and connection requests.

It is a small stdio bridge to [LinkFetch](https://linkfetch.io)'s hosted MCP server: every tool call goes to `https://linkfetch.io/mcp` with your API key, so the tools and prices are always current and nothing runs a browser on your machine. If your client supports remote MCP over HTTP, you can skip this package and [use the URL directly](#no-install-remote-mcp).

Full tool list with prices, and setup for each client: [linkfetch.io/mcp/claude](https://linkfetch.io/mcp/claude)

## Tools

- **Jobs and companies** (no LinkedIn account needed): `search_jobs`, `get_job`, `search_companies`, `get_company`
- **AI functions**: `ai_score`, `ai_classify`, `ai_extract`, `ai_write`, each over up to 25 jobs or companies
- **Your leads**: `list_leads`, `save_lead`, `list_lead_lists`
- **Through your connected LinkedIn account**: people and company search, profiles, employees, posts and reactions, connections, invitations, conversations, messages, comments, reactions, follows

Each call costs a flat number of credits, stated in the tool's description. Every connected account works inside daily and weekly limits that LinkFetch enforces whatever the agent asks for.

## Setup

Create an API key (`lf_…`) on the [MCP page of your LinkFetch dashboard](https://linkfetch.io/app/mcp). New accounts start with free credits. Then add the server to your client: every client runs `npx -y linkfetch-mcp` with `LINKFETCH_API_KEY` set. Node.js 18+ is required.

> Upgrading from 0.1.x? Keys starting with `sk_live_` stopped working when LinkFetch 2 launched in October 2026. Create a new `lf_…` key and replace it in your config.

### Claude Desktop

Settings → Developer → Edit Config, or edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "linkfetch": {
      "command": "npx",
      "args": ["-y", "linkfetch-mcp"],
      "env": { "LINKFETCH_API_KEY": "lf_..." }
    }
  }
}
```

Fully quit and reopen Claude.

### Claude Code

```bash
claude mcp add linkfetch -e LINKFETCH_API_KEY=lf_... -- npx -y linkfetch-mcp
```

### Cursor, Windsurf, Gemini CLI, Cline

These use the same `mcpServers` block as Claude Desktop above. Put it in:

| Client | Config file |
|---|---|
| Cursor | `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| Cline | MCP Servers → Configure → `cline_mcp_settings.json` |

### VS Code (GitHub Copilot agent mode)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "linkfetch": {
      "command": "npx",
      "args": ["-y", "linkfetch-mcp"],
      "env": { "LINKFETCH_API_KEY": "lf_..." }
    }
  }
}
```

### OpenAI Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.linkfetch]
command = "npx"
args = ["-y", "linkfetch-mcp"]
env = { LINKFETCH_API_KEY = "lf_..." }
```

### Zed

`settings.json`:

```json
{
  "context_servers": {
    "linkfetch": {
      "command": "npx",
      "args": ["-y", "linkfetch-mcp"],
      "env": { "LINKFETCH_API_KEY": "lf_..." }
    }
  }
}
```

### Your own agent

Any MCP client library can spawn the server over stdio. OpenAI Agents SDK (Python):

```python
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

async with MCPServerStdio(params={
    "command": "npx",
    "args": ["-y", "linkfetch-mcp"],
    "env": {"LINKFETCH_API_KEY": "lf_..."},
}) as linkfetch:
    agent = Agent(name="LinkedIn researcher", mcp_servers=[linkfetch])
    result = await Runner.run(agent, "Which companies in Berlin started hiring data engineers this week?")
```

LangChain users can load the same server with `langchain-mcp-adapters`.

## No install: remote MCP

Clients that support remote MCP over Streamable HTTP can connect to the hosted server directly:

- URL: `https://linkfetch.io/mcp`
- Header: `Authorization: Bearer lf_...`

Claude (desktop or claude.ai): Settings → Connectors → Add custom connector, with `https://linkfetch.io/mcp?key=lf_...` as the URL.

Claude Code: `claude mcp add --transport http linkfetch https://linkfetch.io/mcp --header "Authorization: Bearer lf_..."`

## Environment variables

| Variable | Required | Default | |
|---|---|---|---|
| `LINKFETCH_API_KEY` | yes | | Your `lf_…` key |
| `LINKFETCH_MCP_URL` | no | `https://linkfetch.io/mcp` | Point at another LinkFetch MCP endpoint |

## Errors

A missing, old or rejected key comes back as an error on every request, with what to do about it, so the agent can tell you. Tool errors (no credits left, no LinkedIn account connected, a limit reached) come from the hosted server as normal tool results.

## Development

```bash
npm install
npm run build
LINKFETCH_API_KEY=lf_... node dist/index.js
```

`src/index.ts` is the whole server: it opens one MCP client connection to the hosted server and forwards `tools/list` and `tools/call` to it.

## License

MIT
