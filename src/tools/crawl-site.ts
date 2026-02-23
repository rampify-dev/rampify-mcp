/**
 * MCP Tool: crawl_site
 * Trigger a fresh site crawl and analysis
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { cache } from '../services/cache.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// Input schema
export const CrawlSiteInput = z.object({
  domain: z.string().optional().describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
});

export type CrawlSiteParams = z.infer<typeof CrawlSiteInput>;

export interface CrawlSiteResult {
  success: boolean;
  message: string;
  summary: {
    total_urls: number;
    urls_checked: number;
    issues_found: number;
    crawl_duration_ms: number;
    crawl_method: 'sitemap' | 'navigation' | 'failed';
  };
}

/**
 * Trigger site crawl
 */
export async function crawlSite(params: CrawlSiteParams): Promise<CrawlSiteResult | { error: string }> {
  const { domain: providedDomain } = params;

  // Use provided domain or fall back to default
  const domain = providedDomain || config.defaultDomain;

  if (!domain) {
    return {
      error: 'No domain specified. Either provide domain parameter or set SEO_CLIENT_DOMAIN environment variable.',
    };
  }

  logger.info('Triggering site crawl', { domain });

  try {
    // Resolve site and client
    const resolved = await apiClient.resolveSiteAndClient({ domain });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId, clientId } = resolved;

    logger.info('Triggering crawl for site', { site_id: siteId, domain });

    // Trigger analysis via backend API
    const result = await apiClient.triggerSiteAnalysis(clientId);

    logger.info('Crawl completed', {
      site_id: siteId,
      total_urls: result.summary.total_urls,
      issues_found: result.summary.issues_found,
    });

    // Invalidate cached data for this domain since we just ran a fresh crawl
    const scanCachePattern = `site-scan:${domain}`;
    const contextCachePattern = `seo-context:${domain}`;
    const deletedScan = cache.deletePattern(scanCachePattern);
    const deletedContext = cache.deletePattern(contextCachePattern);

    if (deletedScan > 0 || deletedContext > 0) {
      logger.info('Invalidated cached data after crawl', {
        domain,
        scan_entries: deletedScan,
        context_entries: deletedContext,
      });
    }

    return {
      success: result.success,
      message: `Successfully crawled ${domain}. Found ${result.summary.total_urls} URLs and ${result.summary.issues_found} issues.`,
      summary: {
        total_urls: result.summary.total_urls,
        urls_checked: result.summary.urls_checked,
        issues_found: result.summary.issues_found,
        crawl_duration_ms: result.summary.duration,
        crawl_method: 'sitemap', // Backend doesn't return this in summary yet
      },
    };

  } catch (error) {
    logger.error('Failed to crawl site', error);
    return {
      error: `Failed to crawl site: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
