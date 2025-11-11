/**
 * MCP Tools Registry
 */

import { getPageSEO, GetPageSEOInput } from './get-page-seo.js';
import { getIssues, GetIssuesInput } from './get-issues.js';
import { crawlSite, CrawlSiteInput } from './crawl-site.js';
import { generateSchema, GenerateSchemaInput } from './generate-schema.js';
import { generateMeta, GenerateMetaInput } from './generate-meta.js';
import { getSecurityContext, GetSecurityContextInput } from './get-security-context.js';

export const tools = {
  get_page_seo: {
    handler: getPageSEO,
    schema: GetPageSEOInput,
    metadata: {
      name: 'get_page_seo',
      description: 'Get comprehensive SEO data and insights for a specific page. Returns performance metrics from Google Search Console, detected issues, optimization opportunities, and actionable recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Site domain (e.g., "example.com")',
          },
          url_path: {
            type: 'string',
            description: 'Page URL path (e.g., "/blog/post")',
          },
          file_path: {
            type: 'string',
            description: 'Local file path (will be resolved to URL)',
          },
          content: {
            type: 'string',
            description: 'Current file content (for context)',
          },
        },
        required: ['domain'],
      },
    },
  },

  get_issues: {
    handler: getIssues,
    schema: GetIssuesInput,
    metadata: {
      name: 'get_issues',
      description: 'Get SEO issues for entire site with health score. Returns health score (0-100), categorized issues by severity, and prioritized recommendations for fixes.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Site domain (e.g., "example.com")',
          },
          filters: {
            type: 'object',
            properties: {
              severity: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['critical', 'high', 'medium', 'low'],
                },
                description: 'Filter by severity levels',
              },
              issue_types: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Filter by issue types',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of issues to return (1-100, default: 50)',
                minimum: 1,
                maximum: 100,
              },
            },
          },
        },
        required: ['domain'],
      },
    },
  },

  crawl_site: {
    handler: crawlSite,
    schema: CrawlSiteInput,
    metadata: {
      name: 'crawl_site',
      description: 'Trigger a fresh site crawl and analysis. Use this after deploying changes to refresh SEO data. Crawls the entire site, checks all URLs, detects issues, and updates the database with current SEO status.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.',
          },
        },
        required: [],
      },
    },
  },

  generate_schema: {
    handler: generateSchema,
    schema: GenerateSchemaInput,
    metadata: {
      name: 'generate_schema',
      description: 'Auto-generate structured data (schema.org JSON-LD) for any page. Detects page type (Article, Product, FAQ, etc.) and generates appropriate schema with validation. Returns ready-to-use code snippets.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.',
          },
          url_path: {
            type: 'string',
            description: 'Page URL path (e.g., "/blog/post") - REQUIRED',
          },
          schema_type: {
            type: 'string',
            enum: ['auto', 'Article', 'BlogPosting', 'Product', 'Organization', 'FAQPage', 'BreadcrumbList'],
            description: 'Schema type to generate. Use "auto" to detect automatically (default).',
          },
        },
        required: ['url_path'],
      },
    },
  },

  generate_meta: {
    handler: generateMeta,
    schema: GenerateMetaInput,
    metadata: {
      name: 'generate_meta',
      description: 'Generate optimized meta tags (title, description, OG tags) for a page. Analyzes page content and provides recommendations for SEO-optimized meta tags based on actual content, headings, and topics.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.',
          },
          url_path: {
            type: 'string',
            description: 'Page URL path (e.g., "/blog" or "/blog/post")',
          },
          include_og_tags: {
            type: 'boolean',
            description: 'Include Open Graph tags for social sharing (default: true)',
          },
          framework: {
            type: 'string',
            enum: ['nextjs', 'html', 'astro', 'remix'],
            description: 'Framework format for code snippet (default: nextjs)',
          },
        },
        required: ['url_path'],
      },
    },
  },

  // PRIVATE TOOL: Not published to npm (excluded via package.json "files" whitelist)
  get_security_context: {
    handler: getSecurityContext,
    schema: GetSecurityContextInput,
    metadata: {
      name: 'get_security_context',
      description: 'Get security analysis for a site (homepage scan only). Returns security score, detected issues (headers, SSL, exposed files, third-party scripts), and actionable remediation steps. PRIVATE BETA.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Site domain (e.g., "example.com")',
          },
        },
        required: ['domain'],
      },
    },
  },
};

export type ToolName = keyof typeof tools;
