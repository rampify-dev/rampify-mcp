/**
 * Local Development Server Analyzer
 * Fetches and analyzes HTML from local dev servers (localhost)
 */

import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import type { SEOContext } from '../types/seo.js';

interface LocalAnalysisResult {
  html: string;
  title: string | null;
  metaDescription: string | null;
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  headings: {
    h1: number;
    h2: number;
    h3: number;
  };
  images: {
    total: number;
    withoutAlt: number;
  };
  links: {
    internal: number;
    external: number;
  };
}

/**
 * Check if domain is a local development server
 */
export function isLocalDomain(domain: string): boolean {
  return domain.includes('localhost') ||
         domain.includes('127.0.0.1') ||
         domain.startsWith('local.');
}

/**
 * Fetch HTML from local dev server
 */
export async function fetchLocalHTML(domain: string, urlPath: string): Promise<string> {
  // Ensure protocol
  const protocol = domain.includes('https') ? '' : 'http://';
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  const fullUrl = `${protocol}${cleanDomain}${urlPath}`;

  logger.info('Fetching from local dev server', { url: fullUrl });

  try {
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'SEO-Ops-MCP/1.0',
      },
      // Short timeout for local servers
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    logger.debug('Successfully fetched local HTML', {
      url: fullUrl,
      size: html.length,
      contentType: response.headers.get('content-type'),
    });

    return html;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('ECONNREFUSED')) {
        throw new Error(
          `Could not connect to local dev server at ${fullUrl}. ` +
          `Make sure your dev server is running (e.g., npm run dev).`
        );
      }
    }
    throw error;
  }
}

/**
 * Analyze HTML content for SEO issues
 */
export function analyzeHTML(html: string, url: string): LocalAnalysisResult {
  const $ = cheerio.load(html);

  // Title
  const title = $('title').first().text().trim() || null;

  // Meta description
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;

  // Schema.org detection
  const schemaScripts = $('script[type="application/ld+json"]').toArray();
  const hasSchemaOrg = schemaScripts.length > 0;
  const schemaTypes: string[] = [];

  schemaScripts.forEach((script) => {
    try {
      const content = $(script).html();
      if (content) {
        const json = JSON.parse(content);
        const type = json['@type'];
        if (type) {
          schemaTypes.push(Array.isArray(type) ? type.join(', ') : type);
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  });

  // Headings
  const headings = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
  };

  // Images
  const allImages = $('img').toArray();
  const imagesWithoutAlt = allImages.filter((img) => !$(img).attr('alt'));

  // Links
  const allLinks = $('a[href]').toArray();
  const internalLinks = allLinks.filter((a) => {
    const href = $(a).attr('href') || '';
    return href.startsWith('/') || href.startsWith('#') || href.includes(url);
  });
  const externalLinks = allLinks.filter((a) => {
    const href = $(a).attr('href') || '';
    return href.startsWith('http') && !href.includes(url);
  });

  return {
    html,
    title,
    metaDescription,
    hasSchemaOrg,
    schemaTypes,
    headings,
    images: {
      total: allImages.length,
      withoutAlt: imagesWithoutAlt.length,
    },
    links: {
      internal: internalLinks.length,
      external: externalLinks.length,
    },
  };
}

/**
 * Generate SEO context from local HTML analysis
 */
export function generateLocalSEOContext(
  analysis: LocalAnalysisResult,
  domain: string,
  urlPath: string
): SEOContext {
  const fullUrl = `http://${domain}${urlPath}`;
  const issues: SEOContext['issues'] = [];

  // Check for title issues (consolidated as title_issue)
  if (!analysis.title) {
    issues.push({
      type: 'title_issue',
      severity: 'critical',
      title: 'Missing page title',
      description: 'Page does not have a <title> tag',
      current_state: { has_title: false, sub_type: 'missing' },
      recommended: { has_title: true },
      impact: {
        estimated_change: 'Critical for SEO - title is the most important on-page factor',
        reasoning: 'Search engines use titles as the primary heading in search results',
        confidence: 'high',
      },
      fix: {
        type: 'add',
        code_snippet: `export const metadata = {\n  title: 'Your Page Title Here',\n};`,
        instructions: 'Add a title to your page metadata (Next.js) or <title> tag (HTML)',
        suggested_location: 'page.tsx metadata or <head> section',
      },
    });
  } else if (analysis.title.length < 30) {
    issues.push({
      type: 'title_issue',
      severity: 'medium',
      title: 'Title is too short',
      description: `Title is only ${analysis.title.length} characters (recommended: 50-60)`,
      current_state: { title: analysis.title, length: analysis.title.length, sub_type: 'too_short' },
      recommended: { min_length: 50, max_length: 60 },
      impact: {
        estimated_change: 'Longer titles provide more context to search engines',
        reasoning: 'Optimal title length is 50-60 characters for full display in search results',
        confidence: 'medium',
      },
      fix: {
        type: 'replace',
        code_snippet: `title: '${analysis.title} - Add more descriptive text here'`,
        instructions: 'Expand your title to 50-60 characters with relevant keywords',
        suggested_location: 'page.tsx metadata',
      },
    });
  } else if (analysis.title.length > 60) {
    issues.push({
      type: 'title_issue',
      severity: 'low',
      title: 'Title might be truncated in search results',
      description: `Title is ${analysis.title.length} characters (recommended: 50-60)`,
      current_state: { title: analysis.title, length: analysis.title.length, sub_type: 'too_long' },
      recommended: { max_length: 60 },
      impact: {
        estimated_change: 'Shorter titles display fully in search results',
        reasoning: 'Google typically displays first 50-60 characters of title',
        confidence: 'medium',
      },
      fix: {
        type: 'replace',
        code_snippet: `title: '${analysis.title.substring(0, 57)}...'`,
        instructions: 'Shorten your title to 50-60 characters',
        suggested_location: 'page.tsx metadata',
      },
    });
  }

  // Check for missing meta description
  if (!analysis.metaDescription) {
    issues.push({
      type: 'meta_description_issue',
      severity: 'high',
      title: 'Missing meta description',
      description: 'Page does not have a meta description',
      current_state: { has_meta_description: false },
      recommended: { has_meta_description: true },
      impact: {
        estimated_change: 'Improves click-through rate from search results',
        reasoning: 'Meta descriptions are shown as snippets in search results',
        confidence: 'high',
      },
      fix: {
        type: 'add',
        code_snippet: `export const metadata = {\n  title: '...',\n  description: 'A compelling 150-160 character description of this page',\n};`,
        instructions: 'Add a meta description to your page metadata',
        suggested_location: 'page.tsx metadata or <head> section',
      },
    });
  } else if (analysis.metaDescription.length < 120) {
    issues.push({
      type: 'meta_description_issue',
      severity: 'low',
      title: 'Meta description is too short',
      description: `Description is only ${analysis.metaDescription.length} characters (recommended: 150-160)`,
      current_state: { description: analysis.metaDescription, length: analysis.metaDescription.length },
      recommended: { min_length: 150, max_length: 160 },
      impact: {
        estimated_change: 'Longer descriptions provide more context in search results',
        reasoning: 'Optimal description length is 150-160 characters',
        confidence: 'medium',
      },
      fix: {
        type: 'replace',
        code_snippet: `description: '${analysis.metaDescription} - Add more descriptive text here to reach 150-160 characters'`,
        instructions: 'Expand your description to 150-160 characters',
        suggested_location: 'page.tsx metadata',
      },
    });
  }

  // Check for missing H1
  if (analysis.headings.h1 === 0) {
    issues.push({
      type: 'missing_h1',
      severity: 'high',
      title: 'Missing H1 heading',
      description: 'Page does not have an H1 heading',
      current_state: { h1_count: 0 },
      recommended: { h1_count: 1 },
      impact: {
        estimated_change: 'H1 helps search engines understand page topic',
        reasoning: 'Every page should have exactly one H1 heading',
        confidence: 'high',
      },
      fix: {
        type: 'add',
        code_snippet: `<h1>Your Main Page Heading</h1>`,
        instructions: 'Add a single H1 heading that describes the main topic of the page',
        suggested_location: 'Top of page content',
      },
    });
  } else if (analysis.headings.h1 > 1) {
    issues.push({
      type: 'multiple_h1',
      severity: 'medium',
      title: 'Multiple H1 headings',
      description: `Page has ${analysis.headings.h1} H1 headings (should be 1)`,
      current_state: { h1_count: analysis.headings.h1 },
      recommended: { h1_count: 1 },
      impact: {
        estimated_change: 'Single H1 provides clearer page hierarchy',
        reasoning: 'Multiple H1s can confuse search engines about page topic',
        confidence: 'medium',
      },
      fix: {
        type: 'replace',
        code_snippet: `<!-- Change extra H1s to H2 or H3 -->\n<h2>Secondary Heading</h2>`,
        instructions: 'Keep only one H1 and change others to H2 or H3',
        suggested_location: 'Page content',
      },
    });
  }

  // Check for images without alt text
  if (analysis.images.withoutAlt > 0) {
    issues.push({
      type: 'images_missing_alt',
      severity: 'medium',
      title: 'Images missing alt text',
      description: `${analysis.images.withoutAlt} out of ${analysis.images.total} images are missing alt text`,
      current_state: { images_without_alt: analysis.images.withoutAlt, total_images: analysis.images.total },
      recommended: { images_without_alt: 0 },
      impact: {
        estimated_change: 'Improves accessibility and image search ranking',
        reasoning: 'Alt text helps search engines understand image content',
        confidence: 'high',
      },
      fix: {
        type: 'add',
        code_snippet: `<Image src="/photo.jpg" alt="Descriptive text about the image" />`,
        instructions: 'Add descriptive alt text to all images',
        suggested_location: 'Image tags in page content',
      },
    });
  }

  // Check for Schema.org
  if (!analysis.hasSchemaOrg) {
    issues.push({
      type: 'missing_schema',
      severity: 'low',
      title: 'No structured data found',
      description: 'Page does not have Schema.org structured data',
      current_state: { has_schema: false },
      recommended: { has_schema: true },
      impact: {
        estimated_change: 'Structured data enables rich results in search',
        reasoning: 'Schema.org helps search engines understand page content better',
        confidence: 'medium',
      },
      fix: {
        type: 'add',
        code_snippet: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "headline": "Your Article Title",\n  "author": { "@type": "Person", "name": "Author Name" }\n}\n</script>`,
        instructions: 'Add appropriate Schema.org markup for your content type',
        suggested_location: '<head> or <body> section',
      },
    });
  }

  // Generate AI summary
  const issueCount = issues.length;
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;

  let aiSummary = `**Local Development Analysis**\n\n`;

  if (issueCount === 0) {
    aiSummary += `✅ Great job! This page has no major SEO issues detected.\n\n`;
  } else {
    aiSummary += `Found ${issueCount} SEO issue${issueCount === 1 ? '' : 's'}`;
    if (criticalCount > 0) {
      aiSummary += ` (${criticalCount} critical)`;
    }
    aiSummary += `.\n\n`;
  }

  aiSummary += `**Page Structure:**\n`;
  aiSummary += `- Title: ${analysis.title ? `"${analysis.title}" (${analysis.title.length} chars)` : '❌ Missing'}\n`;
  aiSummary += `- Meta Description: ${analysis.metaDescription ? `${analysis.metaDescription.length} chars` : '❌ Missing'}\n`;
  aiSummary += `- Headings: ${analysis.headings.h1} H1, ${analysis.headings.h2} H2, ${analysis.headings.h3} H3\n`;
  aiSummary += `- Images: ${analysis.images.total} total (${analysis.images.withoutAlt} missing alt text)\n`;
  aiSummary += `- Links: ${analysis.links.internal} internal, ${analysis.links.external} external\n`;
  aiSummary += `- Schema.org: ${analysis.hasSchemaOrg ? `✅ ${analysis.schemaTypes.join(', ')}` : '❌ Not found'}\n\n`;

  if (criticalCount > 0 || highCount > 0) {
    aiSummary += `**Priority Actions:**\n`;
    issues
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .slice(0, 3)
      .forEach(issue => {
        aiSummary += `- ${issue.title}\n`;
      });
  }

  return {
    url: fullUrl,
    last_analyzed: new Date().toISOString(),
    source: 'local_dev_server',
    fetched_from: fullUrl,
    performance: {
      clicks_last_28_days: 0,
      impressions: 0,
      avg_position: 0,
      ctr: 0,
      top_keywords: [],
      keywords_note: 'Local development - no search performance data available',
      context: {
        your_site_average_position: 0,
        this_page_vs_average: 0,
        percentile_on_site: 'N/A (local dev)',
      },
    },
    issues,
    opportunities: [],
    ai_summary: aiSummary,
    quick_wins: issues.filter(i => i.severity === 'critical' || i.severity === 'high'),
  };
}
