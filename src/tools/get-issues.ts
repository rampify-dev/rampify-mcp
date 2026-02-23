/**
 * MCP Tool: get_issues
 * Get SEO issues for entire site with health score
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { cache } from '../services/cache.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { SiteScanResult } from '../types/seo.js';

// Input schema
export const GetIssuesInput = z.object({
  domain: z.string().optional().describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  filters: z.object({
    severity: z.array(z.enum(['critical', 'high', 'medium', 'low'])).optional(),
    issue_types: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional().describe('Max number of issues to return (default: 50)'),
  }).optional().describe('Filter options'),
});

export type GetIssuesParams = z.infer<typeof GetIssuesInput>;

/**
 * Get site issues with health score
 */
export async function getIssues(params: GetIssuesParams): Promise<SiteScanResult | { error: string }> {
  const { domain: providedDomain, filters } = params;
  const limit = filters?.limit || 50;

  // Use provided domain or fall back to default
  const domain = providedDomain || config.defaultDomain;

  if (!domain) {
    return {
      error: 'No domain specified. Either provide domain parameter or set SEO_CLIENT_DOMAIN environment variable.',
    };
  }

  logger.info('Getting site issues', { domain, filters });

  try {
    // Check cache first (1 hour TTL)
    const cacheKey = cache.generateKey('site-scan', domain, JSON.stringify(filters || {}));
    const cached = cache.get<SiteScanResult>(cacheKey);
    if (cached) {
      logger.info('Returning cached scan result');
      return cached;
    }

    // Resolve site and client
    const resolved = await apiClient.resolveSiteAndClient({ domain });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId } = resolved;

    // Get comprehensive site stats (includes health score, issue counts, etc.)
    const siteStats = await apiClient.getSiteStats(siteId);

    // Get all URLs with their checks (for pages_with_issues calculation)
    const urlsResponse = await apiClient.getSiteUrls(siteId, { limit: 1000 });

    // Get issues from real-time detection API (includes both URL-level and site-level issues)
    const issuesResponse = await apiClient.getSiteIssues(siteId);

    // Map issues to MCP format (keep severity as-is from API: critical/warning/info)
    const allIssues: any[] = issuesResponse.issues.map(issue => ({
      url: issue.url,
      type: issue.type,
      severity: issue.severity, // Don't map - API already returns correct severity
      title: issue.title,
      description: issue.description,
      fix: generateFix(issue.type, null),
      estimated_impact: estimateImpact(issue.type, issue.severity),
      probable_file: null, // Would need file mapping logic
    }));

    // Filter issues
    let filteredIssues = allIssues;

    if (filters?.severity && filters.severity.length > 0) {
      filteredIssues = filteredIssues.filter(issue =>
        filters.severity!.includes(issue.severity)
      );
    }

    if (filters?.issue_types && filters.issue_types.length > 0) {
      filteredIssues = filteredIssues.filter(issue =>
        filters.issue_types!.includes(issue.type)
      );
    }

    // Calculate summary (using correct severity levels: critical/warning/info)
    const criticalWarningIssues = allIssues.filter(i => i.severity === 'critical' || i.severity === 'warning');
    const summary = {
      total_pages: urlsResponse.urls.length,
      pages_with_issues: new Set(criticalWarningIssues.map(i => i.url)).size, // Only count pages with critical/warning
      total_issues: allIssues.length,
      critical_issues: allIssues.filter(i => i.severity === 'critical').length,
      warning_issues: allIssues.filter(i => i.severity === 'warning').length,
      info_issues: allIssues.filter(i => i.severity === 'info').length,
    };

    // Group issues by type
    const issueCategories: Record<string, number> = {};
    for (const issue of allIssues) {
      issueCategories[issue.type] = (issueCategories[issue.type] || 0) + 1;
    }

    // Get top N issues
    const issuesToShow = filteredIssues.slice(0, limit);

    // Generate recommended actions
    const recommendedActions = generateRecommendedActions(summary, issueCategories);

    // Build result using stats from API
    const result: SiteScanResult = {
      domain,
      scanned_at: new Date().toISOString(),
      scan_summary: summary,
      health_score: siteStats.health_score,
      health_grade: siteStats.health_grade,
      issue_categories: issueCategories,
      issues: issuesToShow,
      showing: issuesToShow.length,
      total_matching: filteredIssues.length,
      has_more: filteredIssues.length > limit,
      summary: generateSummary(summary, { score: siteStats.health_score, grade: siteStats.health_grade }),
      recommended_actions: recommendedActions,
    };

    // Cache result
    cache.set(cacheKey, result);

    return result;

  } catch (error) {
    logger.error('Failed to scan site', error);
    return {
      error: `Failed to scan site: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}


/**
 * Generate fix for issue type
 */
function generateFix(type: string, _url: any): any {
  const fixes: Record<string, any> = {
    missing_title: {
      type: 'add',
      code_snippet: '<title>Your Page Title (50-60 chars)</title>',
      instructions: 'Add a descriptive title tag in the <head> section',
    },
    missing_meta_description: {
      type: 'add',
      code_snippet: '<meta name="description" content="Your description (150-160 chars)" />',
      instructions: 'Add a compelling meta description in the <head> section',
    },
    missing_sitemap: {
      type: 'create',
      instructions: 'Create a sitemap.xml file listing all important pages. For Next.js, use next-sitemap or create app/sitemap.ts. For static sites, use a sitemap generator.',
      code_snippet: '// Next.js 14+ sitemap example (app/sitemap.ts)\nexport default function sitemap() {\n  return [\n    { url: "https://yourdomain.com", lastModified: new Date() },\n    { url: "https://yourdomain.com/about", lastModified: new Date() },\n  ];\n}',
    },
    missing_robots_txt: {
      type: 'create',
      instructions: 'Create a robots.txt file in your public directory that references your sitemap.',
      code_snippet: '# robots.txt\nUser-agent: *\nAllow: /\n\nSitemap: https://yourdomain.com/sitemap.xml',
    },
    http_404: {
      type: 'fix-or-redirect',
      instructions: 'Either fix the content or set up a 301 redirect to a relevant page',
    },
    slow_response: {
      type: 'optimize',
      instructions: 'Optimize page load time - check images, scripts, and server response time',
    },
  };

  return fixes[type] || { type: 'review', instructions: 'Review and fix this issue manually' };
}

/**
 * Estimate impact of fixing issue
 */
function estimateImpact(_type: string, severity: string): string {
  if (severity === 'critical') {
    return 'High - immediate impact on search visibility';
  }
  if (severity === 'high' || severity === 'warning') {
    return 'Medium - noticeable improvement when fixed';
  }
  return 'Low - minor improvement';
}

/**
 * Generate summary text
 */
function generateSummary(summary: any, healthScore: any): string {
  const grade = healthScore.grade;
  const gradeText = grade === 'A' ? 'Excellent' : grade === 'B' ? 'Good' : grade === 'C' ? 'Fair' : grade === 'D' ? 'Poor' : 'Critical';

  let text = `Your site has a health score of ${healthScore.score}/100 (${gradeText}, grade ${grade}). `;

  if (summary.critical_issues > 0) {
    text += `🚨 ${summary.critical_issues} critical issues require immediate attention. `;
  }

  if (summary.warning_issues > 0) {
    text += `⚠️ ${summary.warning_issues} warnings should be fixed soon. `;
  }

  if (summary.critical_issues === 0 && summary.warning_issues === 0) {
    text += `✅ No critical or warning issues detected!`;
    if (summary.info_issues > 0) {
      text += ` (${summary.info_issues} info-level items for optimization)`;
    }
  } else {
    text += `Total: ${summary.total_issues} issues across ${summary.pages_with_issues} pages.`;
  }

  return text;
}

/**
 * Generate recommended actions
 */
function generateRecommendedActions(summary: any, categories: Record<string, number>): string[] {
  const actions: string[] = [];

  // PRIORITY 1: Missing sitemap (critical infrastructure)
  if (categories.missing_sitemap && categories.missing_sitemap > 0) {
    actions.push(`🚨 Create a sitemap.xml immediately - this is critical for search engine discovery`);
  }

  // PRIORITY 2: Other critical issues
  if (summary.critical_issues > 0) {
    const criticalCount = summary.critical_issues - (categories.missing_sitemap || 0);
    if (criticalCount > 0) {
      actions.push(`Fix ${criticalCount} critical issues immediately - these are actively hurting your SEO`);
    }
  }

  // PRIORITY 3: 404 errors (if many)
  if (categories.http_404 && categories.http_404 > 5) {
    actions.push(`Audit and fix ${categories.http_404} 404 errors - redirect or restore missing pages`);
  }

  // PRIORITY 4: Missing titles
  if (categories.missing_title && categories.missing_title > 0) {
    actions.push(`Add title tags to ${categories.missing_title} pages - critical for SEO`);
  }

  // PRIORITY 5: Missing robots.txt
  if (categories.missing_robots_txt && categories.missing_robots_txt > 0) {
    actions.push(`Create a robots.txt file to help guide search engines`);
  }

  // PRIORITY 6: Meta descriptions (if many)
  if (categories.missing_meta_description && categories.missing_meta_description > 10) {
    actions.push(`Consider adding meta descriptions to ${categories.missing_meta_description} pages - can improve CTR`);
  }

  // PRIORITY 7: General warnings
  if (summary.warning_issues > 0) {
    actions.push(`Review ${summary.warning_issues} warnings and create a fix plan`);
  }

  // If no issues, encourage best practices
  if (actions.length === 0) {
    actions.push('Keep monitoring your site regularly for new issues');
    actions.push('Consider implementing structured data for better search visibility');
  }

  return actions.slice(0, 5); // Top 5 actions
}
