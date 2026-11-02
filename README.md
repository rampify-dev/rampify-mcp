# Rampify MCP Server

**Turn your coding agent into a marketing agent.** Rampify connects Claude Code, Cursor, GitHub Copilot, or any MCP client to your website's search data. It scans your site, writes what to fix or build as specs your agent ships, and confirms each fix on the next scan, across Google search and AI answers.

[Website](https://www.rampify.dev) · [Product](https://www.rampify.dev/seo-mcp) · [Docs](https://www.rampify.dev/docs/mcp) · [Connect](https://www.rampify.dev/docs/mcp/connecting)

## How it works

1. **Scan.** Rampify crawls your site and reads your Google Search Console performance and keyword data.
2. **Spec.** Each gap becomes a spec: the pages and files it affects, the tasks, and how to tell it's done.
3. **Ship.** Your agent makes the change in your repo and links the commit to the spec.
4. **Verify.** The next scan checks the fix and closes the spec, or reopens it if the problem comes back.

## Why Rampify

- **Real data, built in.** Keyword volumes (via DataForSEO), your Search Console performance, and a live crawl of your own site. No separate data servers to bolt on.
- **Specs, not suggestions.** Findings arrive as work your agent can pick up, with the same paper trail as your engineering: tasks, commits, and a status you can trust.
- **Fixes are checked, not assumed.** A spec is done when the next scan confirms it, not when someone says so.
- **Find your blind spots.** Playbooks like the Category Visibility Check ask AI assistants the questions your buyers ask, show whether they name you, and file a spec for the biggest gap.

## Connect

Rampify is a remote server at `https://www.rampify.dev/api/mcp`. Nothing to install or update, and you sign in with OAuth, so there are no API keys to manage.

**Claude Code**

```bash
claude mcp add --transport http rampify https://www.rampify.dev/api/mcp
```

**Cursor** (`.cursor/mcp.json`), or any client that takes a URL

```json
{
  "mcpServers": {
    "rampify": { "url": "https://www.rampify.dev/api/mcp" }
  }
}
```

**Cline:** open the MCP Servers panel, choose **Remote Servers**, name it `rampify`, paste the URL above, pick **Streamable HTTP**, and click **Add Server**. Then sign in to Rampify when your browser opens. Or add it to `cline_mcp_settings.json` (MCP Servers → Configure → Configure MCP Servers):

```json
{
  "mcpServers": {
    "rampify": {
      "type": "streamableHttp",
      "url": "https://www.rampify.dev/api/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Set `"type": "streamableHttp"`: without it, Cline falls back to the legacy SSE transport.

**VS Code and GitHub Copilot:** install the [Rampify extension](https://marketplace.visualstudio.com/items?itemName=rampify.rampify). It connects Copilot in one click and shows your specs in the sidebar.

**claude.ai:** add a custom connector with the URL above.

Step-by-step for each client: **[Connecting guide →](https://www.rampify.dev/docs/mcp/connecting)**

## Things to ask once you're connected

- "Crawl my site and show me which pages are invisible when buyers ask AI assistants about my category."
- "Research keywords for /pricing, then write the content spec."
- "Audit the meta and schema on my top pages, and open a PR with the fixes."
- "What should I work on next?"

## What your agent can do

More than 50 tools: crawl and scan pages (meta, schema, content, Core Web Vitals), page-level intelligence, Search Console performance, keyword research and clusters, title, meta and JSON-LD generation, feature specs with tasks and linked commits, research playbooks, and campaign tracking. See the **[full tool catalog →](https://www.rampify.dev/docs/mcp)**.

## Learn more

- **Product:** https://www.rampify.dev/seo-mcp
- **Tool catalog:** https://www.rampify.dev/docs/mcp
- **Connecting guide:** https://www.rampify.dev/docs/mcp/connecting
- **Pricing (free to start):** https://www.rampify.dev/pricing

## About this repo

This repo holds Rampify's public listing metadata: `server.json` for the [official MCP Registry](https://registry.modelcontextprotocol.io) (`dev.rampify/rampify-mcp`), the Cursor plugin manifest (`.cursor-plugin/`, `mcp.json`), `glama.json`, and `llms-install.md`, the setup notes AI agents such as Cline read. The server itself runs at rampify.dev.

---

<sub>Looking for the old <code>@rampify/mcp-server</code> npm package? It is deprecated in favor of the hosted remote server above (zero install, always current). Its source is in this repo's history, last at <a href="https://github.com/rampify-dev/rampify-mcp/tree/9e160f0"><code>9e160f0</code></a>.</sub>
