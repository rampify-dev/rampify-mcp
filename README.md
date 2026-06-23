# Rampify MCP Server

[![Glama score](https://glama.ai/mcp/servers/rampify-dev/rampify-mcp/badges/score.svg)](https://glama.ai/mcp/servers/rampify-dev/rampify-mcp)

**The SEO MCP server that acts on your data.** Connect Rampify to Claude Code, Cursor, or any MCP client and your agent crawls your site, synthesizes the gaps, writes the fix as a spec, and ships it. One connection, grounded in your actual site.

[Website](https://www.rampify.dev) · [Product](https://www.rampify.dev/mcp) · [Docs](https://www.rampify.dev/docs/mcp) · [Connect](https://www.rampify.dev/docs/mcp/connecting)

> **Your website is your product. Ship it like one.** Rampify brings your dev workflow (observe, spec, build, verify, iterate) to your website's search and AI-answer visibility, inside the coding agent you already use.

## Why Rampify is different

Most SEO MCP servers are read-only data faucets. Rampify does the whole job in one connection: it pulls the data, finds the gaps, writes the fix as a spec, and your agent ships it (a PR to your repo, or a publish through your CMS's MCP).

- **Batteries included.** Rampify retrieves keyword data (via DataForSEO) and your Google Search Console performance built in, plus a live crawl of your own site. No separate data servers to bolt on.
- **It acts, not just reads.** Generate titles, meta, and JSON-LD schema grounded in that data, then open the PR.
- **Track it like you track code.** Findings become feature specs with affected URLs and tasks, then link the commits that resolve them, so marketing work has the same paper trail as your engineering.
- **Find your blind spots.** Discovery research runs as your buyer and shows where you're invisible when people ask AI assistants about your category.

## Connect

The Rampify MCP server is remote, hosted at `https://www.rampify.dev/api/mcp`. No install, nothing to keep updated, new tools appear automatically. Connect over OAuth, with no API keys to manage:

- **Cursor / VS Code:** one-click add
- **Claude Code / Claude Desktop:** paste one command
- **claude.ai:** add as a custom connector by URL

```bash
# Claude Code (OAuth prompts on first connect)
claude mcp add --transport http rampify https://www.rampify.dev/api/mcp
```

Full per-client instructions: **[Connecting guide →](https://www.rampify.dev/docs/mcp/connecting)**

## What your agent can do

Crawl and scan your site (meta, schema, content, Core Web Vitals), look up keyword volume and trends, pull Search Console performance, generate optimized meta tags and JSON-LD schema, run Discovery research on your AI-answer visibility, turn findings into feature specs, and open PRs. See the **[full tool catalog →](https://www.rampify.dev/docs/mcp)**.

## Learn more

- **Product:** https://www.rampify.dev/mcp
- **Tool catalog:** https://www.rampify.dev/docs/mcp
- **Connecting guide:** https://www.rampify.dev/docs/mcp/connecting
- **Rampify:** https://www.rampify.dev

---

<sub>Looking for the old <code>@rampify/mcp-server</code> npm package? It is deprecated in favor of the hosted remote server above (zero install, always current). The source in this repo is kept for historical reference.</sub>
