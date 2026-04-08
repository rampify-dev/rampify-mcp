/**
 * MCP Tools: Keyword Research
 *
 * lookup_keywords: Look up search volume and competition data for keywords (DataForSEO)
 * suggest_keywords: Get related keyword suggestions for a seed keyword (DataForSEO)
 *
 * Both tools hit the Rampify API which caches results for 30 days.
 * DataForSEO API calls cost money — the response includes from_cache vs from_api counts.
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// ─── Lookup Keywords ────────────────────────────────────────────────────────

export const LookupKeywordsInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Project UUID — use instead of domain when no domain is configured.'),
  keywords: z
    .array(z.string())
    .describe('Keywords to look up (max 100). e.g., ["seo audit tool", "free seo checker"]'),
  locale: z
    .string()
    .optional()
    .default('en')
    .describe('Language locale (default: "en")'),
  location_code: z
    .number()
    .optional()
    .default(2840)
    .describe('DataForSEO location code (default: 2840 = United States). Canada: 2124, UK: 2826.'),
});

export type LookupKeywordsParams = z.infer<typeof LookupKeywordsInput>;

export async function lookupKeywords(params: LookupKeywordsParams): Promise<any> {
  if (!params.keywords || params.keywords.length === 0) {
    return { error: 'keywords array is required and must not be empty.' };
  }

  if (params.keywords.length > 100) {
    return { error: 'Maximum 100 keywords per request.' };
  }

  const domain = params.domain || config.defaultDomain;

  logger.info('Looking up keyword data', { domain, count: params.keywords.length });

  try {
    const resolved = await apiClient.resolveSiteAndClient({
      projectId: params.project_id || config.defaultProjectId,
      domain,
    });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId } = resolved;

    const data = await apiClient.post<any>(
      `/api/sites/${siteId}/keywords/lookup`,
      {
        keywords: params.keywords,
        locale: params.locale,
        location_code: params.location_code,
      }
    );

    if (!data?.success) {
      return { error: data?.error ?? 'Failed to look up keywords.' };
    }

    logger.info('Keyword lookup complete', {
      total: data.results?.length,
      from_cache: data.meta?.from_cache,
      from_api: data.meta?.from_api,
    });

    return {
      success: true,
      keywords: (data.results || []).map((r: any) => ({
        keyword: r.keyword,
        search_volume: r.search_volume,
        competition: r.competition,
        competition_index: r.competition_index,
        cpc: r.cpc,
        low_top_of_page_bid: r.low_top_of_page_bid,
        high_top_of_page_bid: r.high_top_of_page_bid,
        monthly_searches: r.monthly_searches,
      })),
      meta: {
        total: data.meta?.total || 0,
        from_cache: data.meta?.from_cache || 0,
        from_api: data.meta?.from_api || 0,
        locale: data.meta?.locale,
        location_code: data.meta?.location_code,
      },
    };
  } catch (error: any) {
    logger.error('Failed to look up keywords', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to look up keywords: ${message}` };
  }
}

// ─── Suggest Keywords ───────────────────────────────────────────────────────

export const SuggestKeywordsInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Project UUID — use instead of domain when no domain is configured.'),
  seed: z
    .string()
    .describe('Seed keyword to get suggestions for (e.g., "seo audit")'),
  locale: z
    .string()
    .optional()
    .default('en')
    .describe('Language locale (default: "en")'),
  location_code: z
    .number()
    .optional()
    .default(2840)
    .describe('DataForSEO location code (default: 2840 = United States). Canada: 2124, UK: 2826.'),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of suggestions to return (default: 50)'),
});

export type SuggestKeywordsParams = z.infer<typeof SuggestKeywordsInput>;

export async function suggestKeywords(params: SuggestKeywordsParams): Promise<any> {
  if (!params.seed || !params.seed.trim()) {
    return { error: 'seed keyword is required.' };
  }

  const domain = params.domain || config.defaultDomain;

  logger.info('Getting keyword suggestions', { domain, seed: params.seed });

  try {
    const resolved = await apiClient.resolveSiteAndClient({
      projectId: params.project_id || config.defaultProjectId,
      domain,
    });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId } = resolved;

    const data = await apiClient.post<any>(
      `/api/sites/${siteId}/keywords/suggestions`,
      {
        seed: params.seed.trim(),
        locale: params.locale,
        location_code: params.location_code,
        limit: params.limit,
      }
    );

    if (!data?.success) {
      return { error: data?.error ?? 'Failed to get keyword suggestions.' };
    }

    logger.info('Keyword suggestions retrieved', { seed: params.seed, count: data.results?.length });

    return {
      success: true,
      seed: data.seed,
      suggestions: (data.results || []).map((r: any) => ({
        keyword: r.keyword,
        search_volume: r.search_volume,
        competition: r.competition,
        competition_index: r.competition_index,
        cpc: r.cpc,
      })),
      meta: {
        total: data.results?.length || 0,
        locale: data.meta?.locale,
        location_code: data.meta?.location_code,
      },
    };
  } catch (error: any) {
    logger.error('Failed to get keyword suggestions', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to get keyword suggestions: ${message}` };
  }
}
