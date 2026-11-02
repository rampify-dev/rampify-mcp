# Installing the Rampify MCP server

Instructions for an AI agent (Cline, Claude Code, Cursor or another MCP client) setting up Rampify for a user.

## What to know first

- Rampify is a **remote** MCP server at `https://www.rampify.dev/api/mcp`. There is nothing to clone, build, or install: no npm package, no Docker image, no local process.
- The transport is **Streamable HTTP**.
- Sign-in is **OAuth**. Do not ask the user for an API key, and do not add an `Authorization` header. The first connection opens the user's browser to sign in to Rampify (or create a free account) and pick a project.
- The old `@rampify/mcp-server` npm package is deprecated. Do not install it.

## Cline

Add this entry to `cline_mcp_settings.json`, keeping any servers already there:

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

`"type": "streamableHttp"` is required. Without it Cline uses the legacy SSE transport and the connection fails.

## Other clients

- **Claude Code:** `claude mcp add --transport http rampify https://www.rampify.dev/api/mcp`
- **Cursor** (`.cursor/mcp.json`) and other clients that take a URL: `{ "mcpServers": { "rampify": { "url": "https://www.rampify.dev/api/mcp" } } }`
- **VS Code with GitHub Copilot:** install the Rampify extension (`rampify.rampify`), which connects Copilot in one click.

## Check that it worked

1. Once the user has signed in, the server should show as connected with its tools listed.
2. Call `list_projects`. It returns the user's Rampify projects.
3. Call `suggest_next_action`. If the project has no site yet, it asks for the site's URL. Ask the user for it and save it with `update_project`, which starts the first scan.

## If something goes wrong

- **The browser never opens, or sign-in loops:** remove the server and add it again to restart sign-in, and make sure the client is up to date (older versions may not support OAuth for remote servers).
- **401 Unauthorized:** the sign-in didn't finish. Restart it as above.
- **Connection refused or a transport error:** check the URL is exactly `https://www.rampify.dev/api/mcp` and the transport is Streamable HTTP.

More help: https://www.rampify.dev/docs/mcp/connecting
