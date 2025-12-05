# Rampify MCP Server - Claude SEO Checker

[![Website](https://img.shields.io/badge/Website-rampify.dev-blue)](https://www.rampify.dev)
[![Documentation](https://img.shields.io/badge/Docs-Available-green)](https://www.rampify.dev/docs/mcp-server)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Turn Claude Code into a powerful SEO checker.** Real-time site audits, Google Search Console integration, and AI-powered recommendations directly in your editor (Cursor, Claude Code).

**[Get Started with Rampify →](https://www.rampify.dev)**

## What is a Claude SEO Checker?

A **Claude SEO checker** is an MCP (Model Context Protocol) server that adds SEO validation capabilities to Claude Code and Cursor. Unlike **AI rank trackers** that check if your site appears in Claude's AI responses, Rampify analyzes your **website's technical SEO**, validates meta tags, detects issues, and provides actionable fix recommendations—all from your terminal or IDE.

**Not an AI rank tracker.** This is a developer tool that brings SEO intelligence into your coding workflow.

### Claude SEO Checker vs AI Rank Trackers

| Feature | Claude SEO Checker (Rampify) | AI Rank Trackers |
|---------|------------------------------|------------------|
| **What it checks** | YOUR website's SEO (meta tags, schema, performance) | If your site appears in Claude AI responses |
| **Use case** | Fix SEO issues before deployment | Track AI visibility |
| **Where it works** | Your IDE (Claude Code, Cursor) | Separate dashboard |
| **Target audience** | Developers building sites | Marketers tracking AI rank |
| **Data source** | Your site + Google Search Console | Claude AI responses |

**Keywords:** claude seo checker, mcp seo server, seo tools for claude code, cursor seo tools, ai seo checker, claude code seo

Bring Google Search Console data, SEO insights, and AI-powered recommendations directly into your editor. No context switching, no delays.

---

## Why Rampify?

- 🚀 **Real-time SEO intelligence** in your editor (Cursor, Claude Code)
- 🔍 **Google Search Console integration** - See clicks, impressions, rankings
- 📝 **Content strategy insights** - Discover what to write next based on real search data
- 🤖 **AI-powered recommendations** - Fix issues with one command
- 📊 **Pre-deployment checks** - Catch SEO issues before they go live
- 🎯 **Zero context switching** - Stay in your workflow

**[Learn more →](https://www.rampify.dev)**

## Installation

### Prerequisites

- Node.js 18 or higher
- [Rampify account](https://www.rampify.dev) (free to start)

### Install via npm

```bash
npm install -g @rampify/mcp-server
```

The global installation makes the `rampify-mcp` command available system-wide.

## Usage

### Get Your API Key

Before configuring the MCP server, get your API key:

1. **[Sign up for Rampify](https://www.rampify.dev)** (free to start)
2. Go to your [Rampify dashboard](https://www.rampify.dev/dashboard)
3. Navigate to **Settings → API Keys**
4. Click **"Generate New Key"**
5. Copy the key (starts with `sk_live_...`)
6. Use it in the configuration below

### Quick Setup for a Project (Claude CLI)

**Recommended:** Configure MCP server per-project so each project knows its domain:

```bash
cd /path/to/your/project
claude mcp add -s local -t stdio \
  --env BACKEND_API_URL=https://www.rampify.dev \
  --env API_KEY=sk_live_your_api_key_here \
  --env SEO_CLIENT_DOMAIN=your-domain.com \
  rampify -- npx -y @rampify/mcp-server

# Reload your IDE window
```

Now you can use MCP tools **without specifying domain**:
- `get_page_seo` - Automatically uses your project's domain
- `get_issues` - Automatically uses your project's domain
- `crawl_site` - Automatically uses your project's domain

### Global Setup (Claude CLI)

For global access across all projects (must specify domain in each request):

```bash
claude mcp add --scope user rampify npx \
  -y @rampify/mcp-server \
  --env BACKEND_API_URL=https://www.rampify.dev \
  --env API_KEY=sk_live_your_api_key_here

# Reload your IDE window
```

### Manual Configuration (Cursor)

Add to your Cursor settings UI or `~/.cursor/config.json`:

```json
{
  "mcpServers": {
    "rampify": {
      "command": "npx",
      "args": [
        "-y",
        "@rampify/mcp-server"
      ],
      "env": {
        "BACKEND_API_URL": "https://www.rampify.dev",
        "API_KEY": "sk_live_your_api_key_here",
        "SEO_CLIENT_DOMAIN": "your-domain.com"
      }
    }
  }
}
```

### Manual Configuration (Claude Code)

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "rampify": {
      "command": "npx",
      "args": [
        "-y",
        "@rampify/mcp-server"
      ],
      "env": {
        "BACKEND_API_URL": "https://www.rampify.dev",
        "API_KEY": "sk_live_your_api_key_here",
        "SEO_CLIENT_DOMAIN": "your-domain.com"
      }
    }
  }
}
```

---

## Configuration Options

### Environment Variables

- **`BACKEND_API_URL`** (required): Rampify API endpoint - always use `https://www.rampify.dev`
- **`API_KEY`** (required): Your API key from Rampify dashboard (starts with `sk_live_...`)
- **`SEO_CLIENT_DOMAIN`** (optional): Default domain for this project (e.g., `yoursite.com`)
- **`CACHE_TTL`** (optional): Cache duration in seconds (default: 3600)
- **`LOG_LEVEL`** (optional): `debug`, `info`, `warn`, or `error` (default: `info`)

## How to Use Tools

### Discovering Available Tools

**Ask Claude directly:**
```
"What SEO tools are available?"
"What can you do for SEO?"
"List all SEO intelligence tools"
```

Claude will show you all available tools with descriptions.

### Natural Language vs Direct Calls

**Recommended: Use natural language** (Claude will pick the right tool)
```
"What SEO issues does my site have?" → Calls get_issues
"Check this page's SEO" → Calls get_page_seo
"Crawl my site" → Calls crawl_site
```

**Alternative: Call tools directly** (if you know the exact name)
```typescript
get_issues({ domain: "example.com" })
get_page_seo({ domain: "example.com", url_path: "/blog/post" })
crawl_site({ domain: "example.com" })
```

### Common Workflows

**After Deployment:**
```
1. "Crawl my site" (refresh data)
2. "Show me the issues" (review problems)
3. "Check this page's SEO" (verify specific pages)
```

**Before Deployment:**
```
1. "Check SEO of localhost:3000/new-page" (test locally)
2. Fix issues in editor
3. "Re-check SEO" (verify fixes)
4. Deploy when clean!
```

**Regular Monitoring:**
```
1. "What's my site's health score?"
2. "Show critical issues only"
3. Fix high-priority items
4. "Crawl my site" (refresh)
```

**Content Planning:**
```
1. "What should I write next?" (get GSC insights)
2. Review top performing pages and queries
3. Check query opportunities (CTR, rankings, gaps)
4. Create content targeting recommended topics
```

---

## Available Tools

### Quick Reference

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `get_page_seo` | Get SEO data for a specific page | Analyzing individual pages, checking performance |
| `get_issues` | Get all SEO issues with health score | Site-wide audits, finding problems |
| `get_gsc_insights` | Get GSC performance data with content recommendations | Discovering what to write next, finding ranking opportunities |
| `generate_meta` | Generate optimized meta tags | Fixing title/description issues, improving CTR |
| `generate_schema` | Auto-generate structured data | Adding schema.org JSON-LD to pages |
| `crawl_site` | Trigger fresh crawl | After deployments, to refresh data |

---

### 1. `get_page_seo`

Get comprehensive SEO data and insights for a specific page. **Works with both production sites AND local dev servers!**

**Parameters:**
- `domain` (optional): Site domain (e.g., "example.com" or "localhost:3000"). Uses `SEO_CLIENT_DOMAIN` env var if not provided.
- `url_path` (optional): Page URL path (e.g., "/blog/post")
- `file_path` (optional): Local file path (will be resolved to URL)
- `content` (optional): Current file content

**Examples:**

**Production Site:**
```
Ask Claude: "What's the SEO status of this page?" (while editing a file)
# Uses SEO_CLIENT_DOMAIN from env var

Or explicitly:
get_page_seo({ domain: "example.com", url_path: "/blog/post" })
```

**Local Development Server:**
```
Ask Claude: "Audit the local version of this page"
get_page_seo({ domain: "localhost:3000", url_path: "/blog/new-post" })

# Or set default to local:
SEO_CLIENT_DOMAIN=localhost:3000

# Now all queries default to local dev server
```

**Response includes:**
- **Source indicator**: `production_database`, `local_dev_server`, or `direct_content`
- **Fetched from**: Exact URL that was analyzed
- Performance metrics (clicks, impressions, position, CTR) - *only for production*
- Top keywords ranking for this page - *only for production*
- Detected SEO issues with fixes - *works for both local and production*
- Quick win opportunities
- AI summary and recommendations

### Local Development Workflow

**Test pages BEFORE deployment:**

1. **Start your dev server:**
   ```bash
   npm run dev  # Usually runs on localhost:3000
   ```

2. **Query local pages:**
   ```
   Ask Claude: "Check SEO of localhost:3000/blog/draft-post"
   ```

3. **Fix issues in your editor**, then re-check:
   ```
   Ask Claude: "Re-check SEO for this page on localhost"
   ```

4. **Deploy when clean!**

**What gets analyzed locally:**
- ✅ Title tags
- ✅ Meta descriptions
- ✅ Heading structure (H1, H2, H3)
- ✅ Images and alt text
- ✅ Schema.org structured data
- ✅ Internal/external links
- ❌ Search performance (GSC data not available for local)

**Response format:**
```json
{
  "source": "local_dev_server",
  "fetched_from": "http://localhost:3000/blog/new-post",
  "url": "http://localhost:3000/blog/new-post",
  "issues": [...],
  "ai_summary": "**Local Development Analysis**..."
}
```

---

### 2. `get_issues`

Get SEO issues for entire site with health score. Returns a comprehensive report of all detected problems.

**Parameters:**
- `domain` (optional): Site domain (uses `SEO_CLIENT_DOMAIN` if not provided)
- `filters` (optional):
  - `severity`: Array of severity levels to include (`['critical', 'warning', 'info']`)
  - `issue_types`: Array of specific issue types
  - `limit`: Max issues to return (1-100, default: 50)

**Examples:**

```
Ask Claude: "What SEO issues does my site have?"
# Uses SEO_CLIENT_DOMAIN from env var

Ask Claude: "Show me only critical SEO issues"
# AI will filter by severity: critical

Ask Claude: "Check SEO issues for example.com"
get_issues({ domain: "example.com" })
```

**Response includes:**
- Health score (0-100) and grade (A-F)
- Issue summary by severity (critical, warning, info)
- Detailed list of issues with fix recommendations
- Recommended actions prioritized by impact

**Use cases:**
- Site-wide SEO audits
- Finding all problems at once
- Tracking improvements over time
- Prioritizing fixes by severity

---

### 3. `get_gsc_insights` ⭐ NEW

Get Google Search Console performance data with AI-powered content recommendations. **Discover what to write next based on real search data.**

**Parameters:**
- `domain` (optional): Site domain (uses `SEO_CLIENT_DOMAIN` if not provided)
- `period` (optional): Time period for analysis - `7d`, `28d`, or `90d` (default: `28d`)
- `include_recommendations` (optional): Include AI-powered content recommendations (default: `true`)

**Examples:**

```
Ask Claude: "What should I write next?"
# Uses SEO_CLIENT_DOMAIN, analyzes 28-day period

Ask Claude: "Show me my top performing pages from last week"
get_gsc_insights({ period: "7d" })

Ask Claude: "What queries am I ranking for?"
get_gsc_insights({ domain: "example.com", period: "28d" })
```

**What it provides:**

**1. Performance Summary**
- Total clicks, impressions, average position, CTR
- Compare performance across time periods

**2. Top Performing Pages**
- Top 20 pages by clicks
- Each with performance metrics and top queries
- See what content resonates with your audience

**3. Query Opportunities** (4 types automatically detected)
- **Improve CTR**: High impressions (100+) but low CTR (<2%) → Optimize meta tags
- **Improve Ranking**: Position 6-20 → Push to page 1 with content improvements
- **Keyword Cannibalization**: Multiple pages competing for same query → Consolidate content
- **Keyword Gap**: High position (<5) but low volume → Expand content to target related queries

**4. AI-Powered Content Recommendations**
- High-priority topics based on search data
- Target queries for each recommendation
- Prioritized by potential impact (high/medium/low)

**5. Query Clustering**
- Groups related queries into topic themes
- Identifies topic authority opportunities
- Suggests comprehensive content pieces

**Response includes:**

```json
{
  "period": {
    "start": "2025-10-27",
    "end": "2025-11-24",
    "days": 28
  },
  "summary": {
    "total_clicks": 1247,
    "total_impressions": 45382,
    "avg_position": 12.3,
    "avg_ctr": 0.027
  },
  "top_pages": [
    {
      "url": "/blog/context-driven-development",
      "clicks": 324,
      "impressions": 8920,
      "avg_position": 3.2,
      "ctr": 0.036,
      "top_queries": [
        {
          "query": "context driven development",
          "clicks": 156,
          "position": 1.2
        }
      ]
    }
  ],
  "opportunities": [
    {
      "query": "seo tools for developers",
      "impressions": 3450,
      "clicks": 12,
      "position": 5.2,
      "ctr": 0.003,
      "opportunity_type": ["improve_ctr"],
      "recommendation": "Improve CTR for 'seo tools for developers' - getting 3,450 impressions but only 12 clicks (0.3% CTR). Optimize meta title/description."
    }
  ],
  "content_recommendations": [
    {
      "title": "Optimize meta tags for high-impression queries",
      "description": "You're appearing in search results but users aren't clicking...",
      "priority": "high",
      "based_on": "high_impression_low_ctr",
      "queries": ["seo tools for developers", "nextjs seo best practices"]
    }
  ],
  "meta": {
    "total_queries": 247,
    "total_pages_with_data": 18,
    "data_freshness": "GSC data has 2-3 days delay"
  }
}
```

**Use cases:**

**Content Strategy:**
```
User: "What should I write next?"
→ Get top 3 content recommendations with target queries
→ See which topics have proven search interest
→ Discover keyword gaps to expand existing content
```

**Performance Optimization:**
```
User: "Which pages should I optimize?"
→ Find high-impression, low-CTR pages
→ Get specific meta tag improvement suggestions
→ See pages stuck on page 2 (quick wins)
```

**Keyword Research:**
```
User: "What queries am I ranking for?"
→ See all queries with impressions/clicks data
→ Identify cannibalization issues
→ Find related queries to expand content
```

**Topic Authority:**
```
User: "What topics should I create comprehensive guides on?"
→ Get query clusters (related searches)
→ See opportunities for consolidating authority
→ Discover emerging topic trends
```

**When to use:**
- Weekly content planning sessions
- Quarterly content strategy reviews
- After publishing new content (check performance)
- When looking for low-hanging fruit (page 2 rankings)
- Before creating new content (avoid cannibalization)

**Requirements:**
- Google Search Console must be connected (connect in Rampify dashboard)
- Site must have some search traffic (impressions)
- GSC data synced (happens automatically weekly, or trigger manually)

**Pro tips:**
- Start with 28-day period for balanced view (not too recent, not too old)
- Use 7-day period to track recent changes
- Use 90-day period for seasonal trends
- Combine with `generate_meta` to optimize high-opportunity pages
- Run after GSC sync completes for latest data

---

### 4. `crawl_site`

Trigger a fresh site crawl and analysis. This is an **active operation** that fetches and analyzes all pages.

**Parameters:**
- `domain` (optional): Site domain (uses `SEO_CLIENT_DOMAIN` if not provided)

**Examples:**

```
Ask Claude: "Crawl my site after deploying changes"
# Uses SEO_CLIENT_DOMAIN from env var

Ask Claude: "Analyze example.com"
crawl_site({ domain: "example.com" })
```

**What it does:**
1. Discovers all URLs (via sitemap or navigation crawl)
2. Checks each URL (status, speed, SEO elements)
3. Detects issues (missing tags, errors, broken links)
4. Updates database with current state
5. **Automatically clears cache** so next `get_issues` or `get_page_seo` shows fresh data

**Response includes:**
- Total URLs found
- URLs checked
- Issues detected
- Crawl duration
- Crawl method (sitemap vs navigation)

**When to use:**
- After deploying code changes
- After fixing SEO issues
- Before running `get_issues` to ensure fresh data
- Weekly/monthly for monitoring

**Note:** This is the only tool that actively crawls your site. `get_issues` and `get_page_seo` just fetch existing data.

---

### 5. `generate_schema`

Auto-generate structured data (schema.org JSON-LD) for any page. Detects page type and generates appropriate schema with validation.

**Parameters:**
- `domain` (optional): Site domain (uses `SEO_CLIENT_DOMAIN` if not provided)
- `url_path` (required): Page URL path (e.g., "/blog/post")
- `schema_type` (optional): Specific schema type or "auto" to detect (default: "auto")

**Supported schema types:**
- `Article` / `BlogPosting` - Blog posts, articles, news
- `Product` - Product pages, e-commerce
- `Organization` - About pages, company info
- `FAQPage` - FAQ pages with Q&A
- `BreadcrumbList` - Auto-added for navigation

**Examples:**

```
Ask Claude: "Generate schema for /blog/indexnow-faster-indexing"
# Auto-detects Article schema

Ask Claude: "Generate Product schema for /products/widget"
generate_schema({ url_path: "/products/widget", schema_type: "Product" })

Ask Claude: "Add structured data to this page"
# If editing a file, Claude will detect the URL and generate schema
```

**What it does:**
1. Fetches page HTML (local or production)
2. Analyzes content (title, description, author, date, images)
3. Detects page type from URL patterns and content
4. Generates appropriate JSON-LD schema
5. Validates schema and warns about placeholders
6. Returns ready-to-use code snippets

**Response includes:**
- Detected page type
- List of recommended schemas
- Generated JSON-LD for each schema
- Validation results with warnings
- Code snippets (Next.js or HTML)
- Implementation instructions

**Use cases:**
- Fixing "missing schema" warnings from `get_issues`
- Adding rich snippets for better search visibility
- Enabling Google Discover eligibility (requires Article schema)
- Improving CTR with enhanced search results

**Example output:**
```json
{
  "detected_page_type": "Article",
  "recommended_schemas": ["Article", "BreadcrumbList"],
  "schemas": [
    {
      "type": "Article",
      "json_ld": { ... },
      "validation": {
        "valid": false,
        "warnings": ["Replace placeholder values with actual data"]
      }
    }
  ],
  "implementation": {
    "where_to_add": "In your page component's metadata",
    "code_snippet": "// Next.js code here",
    "instructions": "1. Add code to page.tsx..."
  }
}
```

**Pro tip:** After generating schema, test it with [Google Rich Results Test](https://search.google.com/test/rich-results)

---

### 6. `generate_meta` ⭐ Enhanced with Client Profile Context

Generate optimized meta tags (title, description, Open Graph tags) for a page. **Now uses your client profile** to generate highly personalized, business-aware meta tags that align with your target audience, brand voice, and competitive positioning.

**Parameters:**
- `domain` (optional): Site domain (uses `SEO_CLIENT_DOMAIN` if not provided)
- `url_path` (required): Page URL path (e.g., "/blog" or "/blog/post")
- `include_og_tags` (optional): Include Open Graph tags for social sharing (default: true)
- `framework` (optional): Framework format for code snippet - `nextjs`, `html`, `astro`, or `remix` (default: "nextjs")

**✨ NEW: Client Profile Integration**

The tool automatically fetches your client profile and uses context like:
- **Target keywords** → Ensures they appear in title/description
- **Target audience** → Adjusts tone and technical depth
- **Brand voice** → Matches your preferred tone (conversational, technical, formal)
- **Differentiators** → Highlights unique selling points for better CTR
- **Primary CTA** → Ends description with appropriate call-to-action

**Examples:**

```
Ask Claude: "Generate better meta tags for /blog"
# Auto-analyzes content and generates optimized title/description

Ask Claude: "Fix the title too short issue on /blog/post"
generate_meta({ url_path: "/blog/post" })

Ask Claude: "Create meta tags without OG tags for /about"
generate_meta({ url_path: "/about", include_og_tags: false })

Ask Claude: "Generate HTML meta tags for /products/widget"
generate_meta({ url_path: "/products/widget", framework: "html" })
```

**What it does:**
1. Fetches page HTML (local or production)
2. Analyzes current meta tags (title, description)
3. Extracts content structure (headings, topics, word count)
4. Detects page type (homepage, blog_post, blog_index, product, about)
5. Identifies key topics from content
6. Returns analysis for AI to generate optimized meta tags
7. Provides framework-specific code snippets

**Response includes:**
- **Page analysis:**
  - Current title and description
  - Main heading and all headings
  - Word count and content preview
  - Detected page type
  - Key topics extracted from content
  - Images for OG tags
- **Current issues:**
  - Title too short/long
  - Meta description too short/long
  - Missing meta tags
- **AI-generated meta tags:**
  - Optimized title (50-60 characters)
  - Compelling meta description (150-160 characters)
  - Open Graph tags (if requested)
  - Twitter Card tags (if requested)
  - Ready-to-use code for your framework

**Use cases:**
- Fixing "title too short" or "description too short" warnings
- Improving click-through rate (CTR) from search results
- Optimizing social media sharing (OG tags)
- Aligning meta tags with actual page content
- A/B testing different meta descriptions

**Real-World Impact: Before vs. After**

**Without Profile Context (Generic):**
```
Title: Project Management Software | Company
Description: Manage your projects efficiently with our powerful collaboration platform. Streamline workflows and boost productivity.
```

**With Profile Context (Target audience: developers, Differentiators: "real-time collaboration, 50% faster"):**
```
Title: Real-Time Dev Collaboration | 50% Faster | Company
Description: Built for developers: API-first project management with real-time sync. Ship 50% faster than competitors. Try free for 30 days →
```

**Profile Warnings System:**

If your profile is incomplete, you'll get helpful warnings:

```json
{
  "profile_warnings": [
    "⚠️ Target audience not set - recommendations will be generic. Add this in your business profile for better results.",
    "⚠️ No target keywords set - can't optimize for ranking goals. Add keywords in your business profile.",
    "💡 Add your differentiators in the business profile to make meta descriptions more compelling.",
    "💡 Set your brand voice in the business profile to ensure consistent tone."
  ]
}
```

Or if no profile exists at all:
```json
{
  "profile_warnings": [
    "📝 No client profile found. Fill out your profile at /clients/{id}/profile for personalized recommendations."
  ]
}
```

**Example workflow:**

```
1. User: "What SEO issues does my site have?"
   → get_issues shows "Title too short on /blog"

2. User: "Fix the title issue on /blog"
   → generate_meta analyzes /blog page
   → Fetches client profile for context
   → Shows warnings if profile incomplete
   → Claude generates optimized, personalized title
   → Returns Next.js code snippet to add to page

3. User copies code to app/blog/page.tsx
4. User: "Re-check SEO for /blog"
   → get_page_seo confirms title is now optimal
```

**Setting Up Your Profile:**

To get the most value from `generate_meta`:

1. **Visit** `/clients/{your-client-id}/profile` in the dashboard
2. **Fill out key fields:**
   - Target Audience (e.g., "developers and technical founders")
   - Target Keywords (e.g., "real-time collaboration, dev tools")
   - Brand Voice (e.g., "technical but approachable")
   - Your Differentiators (e.g., "50% faster than competitors")
   - Primary CTA (e.g., "try_free" or "request_demo")
3. **Use the tool** - Profile context is automatically applied
4. **See better results** - Meta tags now match your business context

**SEO Best Practices (Built-in):**
- **Title length:** 50-60 characters (includes brand name if space allows)
- **Description length:** 150-160 characters (compelling call-to-action)
- **Keyword placement:** Primary keywords near the start
- **Uniqueness:** Each page gets unique meta tags based on its content
- **Accuracy:** Meta tags reflect actual page content (no clickbait)

**Framework-specific output:**

**Next.js (App Router):**
```typescript
export const metadata = {
  title: "Your Optimized Title | Brand",
  description: "Your compelling meta description...",
  openGraph: {
    title: "Your Optimized Title",
    description: "Your compelling meta description...",
    images: [{ url: "/path/to/image.jpg" }],
  },
};
```

**HTML:**
```html
<title>Your Optimized Title | Brand</title>
<meta name="description" content="Your compelling meta description...">
<meta property="og:title" content="Your Optimized Title">
<meta property="og:description" content="Your compelling meta description...">
```

**Pro tips:**
- Run after fixing content to ensure meta tags match
- Test social sharing with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- Monitor CTR improvements in Google Search Console
- Update meta tags when page content significantly changes

---

## Development

### Watch Mode

```bash
npm run watch
```

This will recompile TypeScript on every change.

### Testing Locally

```bash
# In one terminal, start your backend
cd /path/to/rampify
npm run dev

# In another terminal, build and run MCP server
cd packages/mcp-server
npm run dev
```

The MCP server will connect to your local backend at `http://localhost:3000`.

### Debug Logging

Set `LOG_LEVEL=debug` in your `.env` file to see detailed logs:

```bash
LOG_LEVEL=debug npm run dev
```

## Architecture

```
MCP Server (packages/mcp-server)
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── config.ts             # Configuration loader
│   ├── tools/                # MCP tool implementations
│   │   ├── get-seo-context.ts
│   │   ├── scan-site.ts
│   │   └── index.ts          # Tool registry
│   ├── services/             # Business logic
│   │   ├── api-client.ts     # Backend API client
│   │   ├── cache.ts          # Caching layer
│   │   └── url-resolver.ts   # File path → URL mapping
│   ├── utils/
│   │   └── logger.ts         # Logging utility
│   └── types/                # TypeScript types
│       ├── seo.ts
│       └── api.ts
└── build/                    # Compiled JavaScript (generated)
```

## Caching

The MCP server caches responses for 1 hour (configurable via `CACHE_TTL`) to improve performance.

Cache is cleared automatically when:
- Entries expire (TTL reached)
- Server restarts
- You manually clear (not yet implemented)

## Troubleshooting

### "No client found for domain"

**Solution:** Add the site to your dashboard first at `http://localhost:3000`

### "Backend API connection failed"

**Checklist:**
1. Is the backend running? (`npm run dev` in root directory)
2. Is `BACKEND_API_URL` correct in `.env`?
3. Check logs with `LOG_LEVEL=debug`

### "MCP server not appearing in Cursor"

**Checklist:**
1. Did you build the server? (`npm run build`)
2. Is the path absolute in Cursor config?
3. Restart Cursor after changing config
4. Check Cursor logs (Help → Toggle Developer Tools → Console)

### Empty or missing data

**Common causes:**
- Site not analyzed yet (run analysis in dashboard first)
- GSC not connected (connect in dashboard settings)
- No URLs in database (trigger site analysis)

### "Could not connect to local dev server"

**Solution:**
1. Make sure your dev server is running (`npm run dev`)
2. Verify the port (default is 3000, but yours might be different)
3. Use full domain with port: `localhost:3000` (not just `localhost`)
4. Check dev server logs for CORS or other errors

**Example error:**
```
Could not connect to local dev server at http://localhost:3000/blog/post.
Make sure your dev server is running (e.g., npm run dev).
```

### Local vs Production Confusion

**How to tell which source you're using:**

Every response includes explicit `source` and `fetched_from` fields:

```json
{
  "source": "local_dev_server",        // or "production_database"
  "fetched_from": "http://localhost:3000/page",
  ...
}
```

**Pro tip:** Set `SEO_CLIENT_DOMAIN` per project to avoid specifying domain every time:
- For local dev: `SEO_CLIENT_DOMAIN=localhost:3000`
- For production: `SEO_CLIENT_DOMAIN=yoursite.com`

## Roadmap

### Phase 1: Core Tools (Complete ✅)
- ✅ `get_page_seo` - Get SEO data for a specific page
- ✅ `get_issues` - Get all site issues with health score
- ✅ `get_gsc_insights` - Get GSC performance data with content recommendations ⭐ NEW
- ✅ `generate_meta` - AI-powered title and meta description generation
- ✅ `generate_schema` - Auto-generate structured data (Article, Product, etc.)
- ✅ `crawl_site` - Trigger fresh site crawl

### Phase 2: Workflow & Optimization Tools (Planned 📋)
- 📋 `suggest_internal_links` - Internal linking recommendations
- 📋 `check_before_deploy` - Pre-deployment SEO validation
- 📋 `optimize_blog_post` - Deep optimization for blog content
- 📋 `optimize_landing_page` - Conversion-focused SEO

### Future (Phase 4+)
- Bulk operations across multiple pages
- Historical trend analysis
- Competitive monitoring
- Advanced AI insights and recommendations

## Support

Need help?
- **[Documentation](https://www.rampify.dev/docs/mcp-server)** - Complete guides and tutorials
- **[GitHub Issues](https://github.com/rampify-dev/rampify-mcp/issues)** - Report bugs or request features
- **[Rampify Settings](https://www.rampify.dev/settings/api-keys)** - Manage your sites and API keys

## Learn More

- **[What is Rampify?](https://www.rampify.dev/docs/introduction)** - Product overview
- **[MCP Server Guide](https://www.rampify.dev/docs/mcp-server)** - Detailed documentation
- **[Blog](https://www.rampify.dev/blog)** - SEO tips and product updates

## License

MIT
