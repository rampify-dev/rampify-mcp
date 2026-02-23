/**
 * MCP Tool: get_gsc_insights
 * Get Google Search Console insights with content recommendations
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { cache } from '../services/cache.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// Input schema
export const GetGSCInsightsInput = z.object({
  domain: z.string().optional().describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  period: z.enum(['7d', '28d', '90d']).default('28d').describe('Time period for analysis (default: 28d)'),
  include_recommendations: z.boolean().default(true).describe('Include AI-powered content recommendations (default: true)'),
});

export type GetGSCInsightsParams = z.infer<typeof GetGSCInsightsInput>;

interface TopPage {
  url_id: string;
  url: string;
  clicks: number;
  impressions: number;
  avg_position: number;
  ctr: number;
  top_queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
}

interface QueryOpportunity {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr: number;
  opportunity_type: string[];
  recommendation: string;
}

interface ContentRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  based_on: string;
  queries?: string[];
}

interface GSCInsightsResponse {
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    total_clicks: number;
    total_impressions: number;
    avg_position: number;
    avg_ctr: number;
  };
  top_pages: TopPage[];
  opportunities: QueryOpportunity[];
  content_recommendations: ContentRecommendation[];
  meta: {
    total_queries: number;
    total_pages_with_data: number;
    data_freshness: string;
  };
}

/**
 * Get GSC insights with content recommendations
 */
export async function getGSCInsights(
  params: GetGSCInsightsParams
): Promise<GSCInsightsResponse | { error: string }> {
  const { domain: providedDomain, period, include_recommendations } = params;

  // Use provided domain or fall back to default
  const domain = providedDomain || config.defaultDomain;

  if (!domain) {
    return {
      error: 'No domain specified. Either provide domain parameter or set SEO_CLIENT_DOMAIN environment variable.',
    };
  }

  logger.info('Getting GSC insights', { domain, period, include_recommendations });

  try {
    // Check cache first (5 minute TTL)
    const cacheKey = cache.generateKey('gsc-insights', domain, period, include_recommendations ? 'with-recs' : 'no-recs');
    const cached = cache.get<GSCInsightsResponse>(cacheKey);
    if (cached) {
      logger.debug('Returning cached GSC insights', { domain });
      return cached;
    }

    // Resolve site and client
    const resolved = await apiClient.resolveSiteAndClient({ domain });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId } = resolved;

    // Convert period to days
    const days = parseInt(period.replace('d', ''));

    // Fetch insights from API
    const response = await apiClient.get<GSCInsightsResponse>(
      `/api/sites/${siteId}/gsc-insights`,
      {
        params: {
          days,
          include_recommendations: include_recommendations ? 'true' : 'false',
        },
      }
    );

    if (!response) {
      return {
        error: 'Failed to fetch GSC insights from API',
      };
    }

    // Check if GSC data is available
    if (response.summary.total_impressions === 0) {
      return {
        error: `No Google Search Console data found for "${domain}". Either:\n1. GSC is not connected - connect at https://rampify.dev\n2. Site has no search traffic yet\n3. GSC sync hasn't run yet - data syncs weekly`,
      };
    }

    // Cache for 5 minutes
    cache.set(cacheKey, response, 300);

    logger.info('Successfully fetched GSC insights', {
      domain,
      total_clicks: response.summary.total_clicks,
      total_queries: response.meta.total_queries,
      opportunities: response.opportunities.length,
      recommendations: response.content_recommendations.length,
    });

    return response;
  } catch (error: any) {
    logger.error('Failed to get GSC insights', { error, domain });

    if (error.response?.status === 404) {
      return {
        error: `Site not found for domain "${domain}". Please add this site to Rampify first.`,
      };
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      return {
        error: 'Authentication failed. Please check your API key.',
      };
    }

    return {
      error: `Failed to fetch GSC insights: ${error.message || 'Unknown error'}`,
    };
  }
}

/**
 * Format GSC insights for LLM consumption
 */
export function formatGSCInsightsForLLM(insights: GSCInsightsResponse): string {
  const lines: string[] = [];

  // Header
  lines.push(`# GSC Performance Insights for ${insights.period.days}-Day Period`);
  lines.push(`**Period:** ${insights.period.start} to ${insights.period.end}`);
  lines.push('');

  // Summary
  lines.push('## 📊 Performance Summary');
  lines.push('');
  lines.push(`- **Total Clicks:** ${insights.summary.total_clicks.toLocaleString()}`);
  lines.push(`- **Total Impressions:** ${insights.summary.total_impressions.toLocaleString()}`);
  lines.push(`- **Average Position:** ${insights.summary.avg_position.toFixed(1)}`);
  lines.push(`- **Average CTR:** ${(insights.summary.avg_ctr * 100).toFixed(2)}%`);
  lines.push('');

  // Top Pages
  if (insights.top_pages.length > 0) {
    lines.push('## 🏆 Top Performing Pages');
    lines.push('');
    insights.top_pages.slice(0, 10).forEach((page, idx) => {
      lines.push(`### ${idx + 1}. ${page.url}`);
      lines.push(`- **Clicks:** ${page.clicks} | **Impressions:** ${page.impressions} | **Position:** ${page.avg_position.toFixed(1)} | **CTR:** ${(page.ctr * 100).toFixed(1)}%`);
      if (page.top_queries.length > 0) {
        lines.push('- **Top Queries:**');
        page.top_queries.slice(0, 3).forEach(q => {
          lines.push(`  - "${q.query}" - ${q.clicks} clicks, position ${q.position.toFixed(1)}`);
        });
      }
      lines.push('');
    });
  }

  // Opportunities
  if (insights.opportunities.length > 0) {
    lines.push('## 🎯 Query Opportunities');
    lines.push('');
    lines.push('These queries represent actionable opportunities to improve your search performance:');
    lines.push('');

    // Group by opportunity type
    const byType = new Map<string, QueryOpportunity[]>();
    insights.opportunities.forEach(opp => {
      opp.opportunity_type.forEach(type => {
        if (!byType.has(type)) {
          byType.set(type, []);
        }
        byType.get(type)!.push(opp);
      });
    });

    // High-impression, low CTR
    const improveCtr = byType.get('improve_ctr') || [];
    if (improveCtr.length > 0) {
      lines.push('### 🔴 High Impressions, Low CTR (Optimize Meta Tags)');
      lines.push('');
      improveCtr.slice(0, 5).forEach(opp => {
        lines.push(`- **"${opp.query}"**`);
        lines.push(`  - ${opp.impressions} impressions, ${opp.clicks} clicks (${(opp.ctr * 100).toFixed(1)}% CTR)`);
        lines.push(`  - Position: ${opp.position.toFixed(1)}`);
        lines.push(`  - 💡 ${opp.recommendation}`);
        lines.push('');
      });
    }

    // Improve ranking
    const improveRanking = byType.get('improve_ranking') || [];
    if (improveRanking.length > 0) {
      lines.push('### 🟡 Improve Rankings (Target Page 1)');
      lines.push('');
      improveRanking.slice(0, 5).forEach(opp => {
        lines.push(`- **"${opp.query}"**`);
        lines.push(`  - Position: ${opp.position.toFixed(1)} | ${opp.impressions} impressions`);
        lines.push(`  - 💡 ${opp.recommendation}`);
        lines.push('');
      });
    }

    // Keyword cannibalization
    const cannibalization = byType.get('cannibalization') || [];
    if (cannibalization.length > 0) {
      lines.push('### ⚠️ Keyword Cannibalization (Multiple Pages Competing)');
      lines.push('');
      cannibalization.slice(0, 3).forEach(opp => {
        lines.push(`- **"${opp.query}"**`);
        lines.push(`  - 💡 ${opp.recommendation}`);
        lines.push('');
      });
    }

    // Keyword gaps
    const keywordGaps = byType.get('keyword_gap') || [];
    if (keywordGaps.length > 0) {
      lines.push('### 🟢 Keyword Gaps (Expand Content)');
      lines.push('');
      keywordGaps.slice(0, 3).forEach(opp => {
        lines.push(`- **"${opp.query}"**`);
        lines.push(`  - Position: ${opp.position.toFixed(1)} | Only ${opp.impressions} impressions`);
        lines.push(`  - 💡 ${opp.recommendation}`);
        lines.push('');
      });
    }
  }

  // Content Recommendations
  if (insights.content_recommendations.length > 0) {
    lines.push('## 💡 Content Recommendations');
    lines.push('');
    lines.push('AI-powered recommendations based on your search performance:');
    lines.push('');

    insights.content_recommendations.forEach((rec) => {
      const emoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      lines.push(`### ${emoji} ${rec.title}`);
      lines.push('');
      lines.push(rec.description);
      lines.push('');
      if (rec.queries && rec.queries.length > 0) {
        lines.push('**Target Queries:**');
        rec.queries.slice(0, 5).forEach(q => {
          lines.push(`- "${q}"`);
        });
        lines.push('');
      }
    });
  }

  // Meta
  lines.push('---');
  lines.push('');
  lines.push(`**Total Queries Tracked:** ${insights.meta.total_queries.toLocaleString()}`);
  lines.push(`**Pages with Data:** ${insights.meta.total_pages_with_data}`);
  lines.push(`**Note:** ${insights.meta.data_freshness}`);

  return lines.join('\n');
}
