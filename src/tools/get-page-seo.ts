/**
 * MCP Tool: get_page_seo
 * Get comprehensive SEO data and insights for a specific page
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { cache } from '../services/cache.js';
import { urlResolver } from '../services/url-resolver.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { detectGSCDataState } from '../utils/gsc-state.js';
import { isLocalDomain, fetchLocalHTML, analyzeHTML, generateLocalSEOContext } from '../services/local-analyzer.js';
import type { SEOContext } from '../types/seo.js';

// Input schema
export const GetPageSEOInput = z.object({
  domain: z.string().optional().describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  url_path: z.string().optional().describe('Page URL path (e.g., "/blog/post")'),
  file_path: z.string().optional().describe('Local file path'),
  content: z.string().optional().describe('Current file content'),
});

export type GetPageSEOParams = z.infer<typeof GetPageSEOInput>;

/**
 * Get SEO data for a specific page
 */
export async function getPageSEO(params: GetPageSEOParams): Promise<SEOContext | { error: string }> {
  const { domain: providedDomain, url_path, file_path } = params;

  // Use provided domain or fall back to default
  const domain = providedDomain || config.defaultDomain;

  if (!domain) {
    return {
      error: 'No domain specified. Either provide domain parameter or set SEO_CLIENT_DOMAIN environment variable.',
    };
  }

  logger.info('Getting page SEO data', { domain, url_path, file_path: file_path ? '(provided)' : undefined });

  try {
    // Check if this is a local development server
    if (isLocalDomain(domain)) {
      logger.info('Detected local domain, fetching from dev server', { domain });

      // Resolve URL path from file path if needed
      let resolvedUrlPath = url_path || '/';
      if (!url_path && file_path) {
        const resolved = urlResolver.resolve(file_path);
        if (resolved) {
          resolvedUrlPath = resolved.urlPath;
          logger.debug('Resolved file path to URL', { file_path, url_path: resolvedUrlPath });
        }
      }

      // Fetch and analyze HTML from local dev server
      const html = await fetchLocalHTML(domain, resolvedUrlPath);
      const analysis = analyzeHTML(html, domain);
      const context = generateLocalSEOContext(analysis, domain, resolvedUrlPath);

      return context;
    }

    // Production flow: Check cache first
    const cacheKey = cache.generateKey('seo-context', domain, url_path || file_path);
    const cached = cache.get<SEOContext>(cacheKey);
    if (cached) {
      return cached;
    }

    // Resolve site and client
    const resolved = await apiClient.resolveSiteAndClient({ domain });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId } = resolved;

    // Resolve URL path from file path if needed
    let resolvedUrlPath = url_path;
    if (!resolvedUrlPath && file_path) {
      const resolved = urlResolver.resolve(file_path);
      if (resolved) {
        resolvedUrlPath = resolved.urlPath;
        logger.debug('Resolved file path to URL', { file_path, url_path: resolvedUrlPath, confidence: resolved.confidence });
      }
    }

    // Get site URLs to find matching URL
    const urlsResponse = await apiClient.getSiteUrls(siteId, { limit: 1000 });

    let targetUrl = null;
    if (resolvedUrlPath) {
      // Find matching URL in database
      const match = urlResolver.findMatch(
        resolvedUrlPath,
        urlsResponse.urls.map(u => new URL(u.url).pathname)
      );

      if (match) {
        targetUrl = urlsResponse.urls.find(u => new URL(u.url).pathname === match);
      }
    }

    // If no specific URL, provide site-level context
    if (!targetUrl) {
      const siteContext = await getSiteLevelContext(siteId, domain);
      cache.set(cacheKey, siteContext);
      return siteContext;
    }

    // Get URL-specific context
    const urlContext = await getURLLevelContext(targetUrl, siteId, domain);
    cache.set(cacheKey, urlContext);
    return urlContext;

  } catch (error) {
    logger.error('Failed to get SEO context', error);
    return {
      error: `Failed to fetch SEO context: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get site-level SEO context (when no specific URL is provided)
 */
async function getSiteLevelContext(siteId: string, domain: string): Promise<SEOContext> {
  // Get site-level GSC data
  const queries = await apiClient.getSiteQueries(siteId, {
    limit: 20,
  });

  // Get site URLs to calculate issues
  const urlsResponse = await apiClient.getSiteUrls(siteId, { limit: 1000 });

  const totalUrls = urlsResponse.urls.length;
  const urlsWith404 = urlsResponse.urls.filter(u => u.current_http_status === 404).length;
  const urlsWithoutTitle = urlsResponse.urls.filter(u => !u.current_has_title).length;

  const topKeywords = queries.queries.slice(0, 10).map(q => ({
    keyword: q.query,
    position: q.position,
    clicks: q.clicks,
    impressions: q.impressions,
    trend: 'stable' as const, // Would need historical data for trend
  }));

  const issues = [];
  if (urlsWith404 > 0) {
    issues.push({
      type: 'http_404',
      severity: 'critical' as const,
      title: `${urlsWith404} pages returning 404`,
      description: `Found ${urlsWith404} URLs that return 404 Not Found errors`,
      current_state: { count: urlsWith404 },
      recommended: { action: 'Fix or remove 404 pages' },
      impact: {
        estimated_change: `Potential to improve ${urlsWith404} pages`,
        reasoning: '404 pages hurt user experience and waste crawl budget',
        confidence: 'high' as const,
      },
      fix: {
        type: 'remove' as const,
        code_snippet: '',
        instructions: 'Review each 404 page and either fix the content or redirect to relevant pages',
        suggested_location: 'Server configuration or routing files',
      },
    });
  }

  if (urlsWithoutTitle > 0) {
    issues.push({
      type: 'missing_title',
      severity: 'high' as const,
      title: `${urlsWithoutTitle} pages missing title tags`,
      description: `Found ${urlsWithoutTitle} URLs without title tags`,
      current_state: { count: urlsWithoutTitle },
      recommended: { action: 'Add title tags to all pages' },
      impact: {
        estimated_change: `Improve ${urlsWithoutTitle} pages`,
        reasoning: 'Title tags are critical for SEO and user experience',
        confidence: 'high' as const,
      },
      fix: {
        type: 'add' as const,
        code_snippet: '<title>Your Page Title Here</title>',
        instructions: 'Add descriptive, keyword-rich title tags to each page',
        suggested_location: '<head> section or layout component',
      },
    });
  }

  return {
    url: `https://${domain}`,
    last_analyzed: new Date().toISOString(),
    source: 'production_database',
    fetched_from: `https://${domain} (site-level data)`,
    performance: {
      clicks_last_28_days: queries.summary.total_clicks,
      impressions: queries.summary.total_impressions,
      avg_position: queries.summary.avg_position,
      ctr: queries.summary.avg_ctr,
      top_keywords: topKeywords,
      context: {
        your_site_average_position: queries.summary.avg_position,
        this_page_vs_average: 0,
        percentile_on_site: '50th',
      },
    },
    issues,
    opportunities: [],
    ai_summary: `Your site has ${totalUrls} indexed pages. ${urlsWith404 > 0 ? `⚠️ Critical: ${urlsWith404} pages are returning 404 errors. ` : ''}${urlsWithoutTitle > 0 ? `⚠️ ${urlsWithoutTitle} pages are missing title tags. ` : ''}Top performing keyword: "${topKeywords[0]?.keyword || 'N/A'}" (position ${topKeywords[0]?.position || 'N/A'}).`,
    quick_wins: issues.slice(0, 3),
  };
}

/**
 * Get URL-level SEO context
 */
async function getURLLevelContext(url: any, siteId: string, _domain: string): Promise<SEOContext> {
  // Get GSC data for this URL (last 28 days)
  const queries = await apiClient.getUrlQueries(url.id, {
    limit: 20,
    days: 28, // Last 28 days of data
  });

  // Get site-level data for comparison
  const siteQueries = await apiClient.getSiteQueries(siteId);

  const topKeywords = queries.queries.slice(0, 10).map(q => ({
    keyword: q.query,
    position: q.position,
    clicks: q.clicks,
    impressions: q.impressions,
    trend: 'stable' as const,
  }));

  const issues = (url.issues || []).map((issue: any) => ({
    type: issue.type,
    severity: issue.severity,
    title: issue.title || issue.type,
    description: issue.description || '',
    current_state: issue,
    recommended: {},
    impact: {
      estimated_change: issue.severity === 'critical' ? 'High impact' : 'Medium impact',
      reasoning: 'Standard SEO best practice',
      confidence: 'medium' as const,
    },
    fix: {
      type: 'replace' as const,
      code_snippet: '',
      instructions: 'Fix the issue based on type',
      suggested_location: url.url,
    },
  }));

  // Add missing meta description as opportunity if applicable
  const opportunities = [];
  // After schema refactoring: use current_has_meta_description directly
  if (!url.current_has_meta_description) {
    opportunities.push({
      title: 'Add meta description',
      description: 'This page is missing a meta description',
      estimated_impact: 'Could improve CTR by 5-10%',
      effort: 'Low (5 minutes)',
      priority_score: 80,
      suggestion: 'Add a compelling 150-160 character description that includes your target keywords',
      code_example: '<meta name="description" content="Your compelling description here" />',
    });
  }

  const thisPagePosition = queries.summary.avg_position || 0;
  const siteAvgPosition = siteQueries.summary.avg_position || 0;
  const percentile = thisPagePosition < siteAvgPosition ? 'top 25th' : thisPagePosition === siteAvgPosition ? '50th' : 'bottom 25th';

  // Detect GSC data state to provide appropriate messaging
  const gscState = detectGSCDataState(
    url,
    queries.summary.total_impressions,
    queries.summary.total_clicks
  );

  // Generate AI summary with GSC state awareness
  const positionContext = thisPagePosition > 0
    ? `This page ranks at position ${thisPagePosition.toFixed(1)} on average${
        thisPagePosition < siteAvgPosition ? ' (better than site average!)' : ''
      }. `
    : '';

  const issuesContext = issues.length > 0
    ? `⚠️ ${issues.length} SEO issues detected.`
    : '✅ No major issues detected.';

  const aiSummary = gscState.hasData
    ? `${gscState.emoji} ${positionContext}${gscState.message}. ${issuesContext}`
    : `${gscState.emoji} ${gscState.message} ${issuesContext}`;

  // Add note when we have impressions but no keyword data (Google privacy threshold)
  const keywordsNote =
    topKeywords.length === 0 && queries.summary.total_impressions > 0
      ? `Keywords hidden due to low search volume (Google privacy threshold). Total: ${queries.summary.total_impressions} impressions across multiple low-volume queries.`
      : undefined;

  return {
    url: url.url,
    last_analyzed: url.last_checked_at || new Date().toISOString(),
    source: 'production_database',
    fetched_from: url.url,
    performance: {
      clicks_last_28_days: queries.summary.total_clicks,
      impressions: queries.summary.total_impressions,
      avg_position: thisPagePosition,
      ctr: queries.summary.avg_ctr,
      top_keywords: topKeywords,
      ...(keywordsNote && { keywords_note: keywordsNote }),
      context: {
        your_site_average_position: siteAvgPosition,
        this_page_vs_average: siteAvgPosition - thisPagePosition,
        percentile_on_site: percentile,
      },
    },
    issues,
    opportunities,
    ai_summary: aiSummary,
    quick_wins: [...opportunities, ...issues].slice(0, 3),
  };
}
