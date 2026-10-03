# linkfetch-mcp — LinkedIn MCP server for Claude

<!-- mcp-name: io.github.ffucucuoglu/linkfetch-mcp -->

[![npm](https://img.shields.io/npm/v/linkfetch-mcp)](https://www.npmjs.com/package/linkfetch-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-stdio-black)](https://modelcontextprotocol.io)

[Model Context Protocol](https://modelcontextprotocol.io) server for [LinkFetch](https://linkfetch.io). It gives Claude Desktop, Claude Code, Cursor, Windsurf, Zed and any other MCP client 24 LinkedIn tools: jobs search, profiles, companies, people and post search, posts and reactions, and your own inbox. Claude calls them directly, with no browser automation.

Setup guide for Claude: [linkfetch.io/mcp/claude](https://linkfetch.io/mcp/claude)

## Tools

**Jobs** (API key only, from LinkFetch's own index)

- `linkfetch_search_jobs`: keyword and filter search (location, company, industry, level, salary, posted window).
- `linkfetch_get_job` / `linkfetch_get_job_by_url`: full detail for one posting by ID or any LinkedIn job URL/URN.
- `linkfetch_get_job_applicants`: timestamped applicant-count series for a posting.
- `linkfetch_jobs_database_info`: coverage, freshness and schema of the index.
- `linkfetch_search_locations`: resolve a place name to a LinkedIn geo ID.

**People, companies, posts, groups** (cache-first; misses resolve through your own LinkedIn session, via the Chrome extension or Cloud mode)

- `linkfetch_get_profile`, `linkfetch_get_profile_posts`
- `linkfetch_get_company`, `linkfetch_get_company_employees`, `linkfetch_get_company_posts`
- `linkfetch_search_people`, `linkfetch_search_companies`, `linkfetch_search_posts`, `linkfetch_search_groups`
- `linkfetch_get_post`, `linkfetch_get_post_reactions`, `linkfetch_get_group`

**Inbox** (Cloud mode only, never cached)

- `linkfetch_list_conversations`, `linkfetch_read_conversation`

**Account and safety** (free)

- `linkfetch_linkedin_connection`: whether LinkedIn is connected, and the link to connect it.
- `linkfetch_safety_status`, `linkfetch_safety_limits`, `linkfetch_safety_resume`: per-action budgets (for example at most 100 connection requests a week) and pause handling.

All reads are credit-metered, with the same costs as the REST API. New accounts get $5 of free credit. Get an API key at [linkfetch.io/dashboard](https://linkfetch.io/dashboard).

## Why not browser automation?

Most LinkedIn MCP servers drive a local Playwright browser with your cookies. That is slow, breaks when LinkedIn changes its markup, and nothing stops an agent loop from getting your account restricted. This server calls the LinkFetch API instead: jobs come from a pre-built index (no LinkedIn account involved), member data is cache-first, and every call that touches your account is checked against published per-minute, per-day and per-week safety limits first.

## Setup

You need a LinkFetch API key (`LINKFETCH_API_KEY`). Configure the server in your MCP client:

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "linkfetch": {
      "command": "npx",
      "args": ["-y", "linkfetch-mcp"],
      "env": {
        "LINKFETCH_API_KEY": "sk_live_..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add linkfetch -e LINKFETCH_API_KEY=sk_live_... -- npx -y linkfetch-mcp
```

### Cursor / Windsurf / other MCP clients

Any client that speaks MCP over stdio works — point it at `npx -y linkfetch-mcp` with `LINKFETCH_API_KEY` in the environment.

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `LINKFETCH_API_KEY` | yes | — | Bearer token from the LinkFetch dashboard. |
| `LINKFETCH_API_URL` | no | `https://api.linkfetch.io` | Override for self-hosted or local-dev instances. |

## Error handling

Three error codes are worth knowing about:

- **`extension_required` (422)** — the requested record isn't in our cache yet. The LinkFetch Chrome extension captures LinkedIn pages on a signed-in session and POSTs them to our ingest endpoints. Open the extension on the relevant page and retry. Alternatively the user can connect their LinkedIn account (Cloud mode) at [linkfetch.io/linkedin](https://linkfetch.io/linkedin), after which cache misses run live on their account within safety limits.
- **`linkedin_not_connected` (422)** — the record isn't cached and the user hasn't connected LinkedIn. Connect at [linkfetch.io/linkedin](https://linkfetch.io/linkedin) (Cloud mode) or use the Chrome extension, then retry.
- **`insufficient_credits` (402)** — top up at [linkfetch.io/dashboard](https://linkfetch.io/dashboard).

The server surfaces each with a clear resolution message so the LLM can guide the user through the next step.

## Development

```bash
npm install
npm run build
npm run typecheck
```

To run against a local LinkFetch API instance:

```bash
LINKFETCH_API_KEY=... LINKFETCH_API_URL=http://localhost:4000 \
  npm run dev
```

## License

MIT
