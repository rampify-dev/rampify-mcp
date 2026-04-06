/**
 * MCP Tool: optimize_content
 * Generate specific, actionable optimization instructions for a page
 * based on its keyword audit results.
 *
 * Workflow:
 * 1. Runs content audit for the page (fetches HTML, analyzes keywords)
 * 2. For each failing check, generates fix instructions
 * 3. Returns structured instructions the AI agent can execute
 *
 * The AI agent reads the instructions and modifies source files.
 * This tool provides the "what to fix", the agent provides the "how".
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const OptimizeContentInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Project UUID — use instead of domain when no domain is configured.'),
  url_path: z
    .string()
    .describe('Page URL path to optimize (e.g., "/service-areas/mosquito-control-toronto/")'),
});

export type OptimizeContentParams = z.infer<typeof OptimizeContentInput>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptimizationInstruction {
  priority: 'high' | 'medium' | 'low';
  category: 'density' | 'placement' | 'formatting' | 'internal_links' | 'external_links';
  instruction: string;
  current_state: string;
  target_state: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function optimizeContent(params: OptimizeContentParams): Promise<any> {
  if (!params.url_path) {
    return { error: 'url_path is required.' };
  }

  const domain = params.domain || config.defaultDomain;

  logger.info('Generating content optimization instructions', {
    domain,
    url_path: params.url_path,
  });

  try {
    // Resolve site
    const resolved = await apiClient.resolveSiteAndClient({
      projectId: params.project_id || config.defaultProjectId,
      domain,
    });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId } = resolved;

    // Run the content audit for this specific page
    // First, find the URL ID for the given path
    const urlsResponse = await apiClient.getSiteUrls(siteId, { limit: 1000 });
    const targetUrl = urlsResponse.urls.find((u) => {
      try {
        return new URL(u.url).pathname === params.url_path;
      } catch {
        return false;
      }
    });

    if (!targetUrl) {
      return { error: `Page not found: ${params.url_path}. Run a site crawl first.` };
    }

    // Trigger content audit for this page
    const auditResult = await apiClient.post<any>(
      `/api/sites/${siteId}/content-audit`,
      { url_ids: [targetUrl.id] }
    );

    if (!auditResult?.success) {
      return { error: auditResult?.error || 'Failed to run content audit.' };
    }

    const pageResult = auditResult.results?.[0];
    if (!pageResult || pageResult.error) {
      return { error: pageResult?.error || 'Audit returned no results for this page.' };
    }

    // Get the audit data from the database
    const auditData = await apiClient.get<any>(`/api/sites/${siteId}/content-audit`);
    const pageAudit = auditData?.pages?.find((p: any) => p.url_id === targetUrl.id);

    if (!pageAudit) {
      return { error: 'No audit data found after running audit.' };
    }

    // Generate optimization instructions
    const instructions: OptimizationInstruction[] = [];
    const keywords = pageAudit.keywords || [];
    const wordCount = keywords[0]?.word_count || 0;

    for (const kw of keywords) {
      const isPrimary = kw.keyword_role === 'primary';

      // Density instructions
      if (!kw.density_pass) {
        const targetOccurrences = Math.ceil(wordCount * (kw.target_density / 100));
        const needed = Math.max(0, targetOccurrences - kw.occurrence_count);

        instructions.push({
          priority: isPrimary ? 'high' : 'medium',
          category: 'density',
          instruction: `Add ${needed} more natural occurrences of "${kw.keyword}" throughout the page content. Distribute evenly across paragraphs. Do not force unnatural phrasing.`,
          current_state: `"${kw.keyword}" appears ${kw.occurrence_count} time(s) — density is ${Number(kw.actual_density).toFixed(2)}%`,
          target_state: `Target: ${kw.target_density}% density (approximately ${targetOccurrences} occurrences in ${wordCount} words)`,
        });
      }

      // Title placement
      if (isPrimary && !kw.in_title) {
        instructions.push({
          priority: 'high',
          category: 'placement',
          instruction: `Add "${kw.keyword}" to the page title tag. The title should lead with the primary keyword and stay under 60 characters.`,
          current_state: `Primary keyword "${kw.keyword}" is missing from the title tag`,
          target_state: `Title contains "${kw.keyword}" near the beginning`,
        });
      }

      // Meta description placement
      if (isPrimary && !kw.in_meta_description) {
        instructions.push({
          priority: 'high',
          category: 'placement',
          instruction: `Add "${kw.keyword}" to the meta description. Write a compelling 150-160 character description that includes the keyword and encourages clicks.`,
          current_state: `Primary keyword "${kw.keyword}" is missing from the meta description`,
          target_state: `Meta description contains "${kw.keyword}" and is 150-160 characters`,
        });
      }

      // H1 placement
      if (isPrimary && !kw.in_h1) {
        instructions.push({
          priority: 'high',
          category: 'placement',
          instruction: `Add "${kw.keyword}" to the H1 heading. The page should have exactly one H1 that contains the primary keyword.`,
          current_state: `Primary keyword "${kw.keyword}" is missing from the H1 heading`,
          target_state: `H1 heading contains "${kw.keyword}"`,
        });
      }

      // Formatting variety
      const formats = kw.formats_used || { bold: 0, italic: 0, underline: 0, hyperlink: 0 };
      const totalFormats = formats.bold + formats.italic + formats.underline + formats.hyperlink;

      if (totalFormats === 0 && kw.occurrence_count > 0) {
        instructions.push({
          priority: 'low',
          category: 'formatting',
          instruction: `Add formatting variety for "${kw.keyword}": wrap in <strong> tags 1-2 times, <em> tags 1 time, and use as anchor text in an internal link 1 time. Shuffle placement across different paragraphs.`,
          current_state: `"${kw.keyword}" has no formatting (bold/italic/underline/hyperlink)`,
          target_state: `Keyword appears in at least 2 different formats across the page`,
        });
      }
    }

    // Internal links
    if (pageResult.issues?.some((i: string) => i.includes('internal link'))) {
      // Get site URLs for link suggestions
      const siteUrls = urlsResponse.urls
        .filter((u) => {
          try {
            return new URL(u.url).pathname !== params.url_path;
          } catch {
            return false;
          }
        })
        .slice(0, 5)
        .map((u) => {
          try {
            return new URL(u.url).pathname;
          } catch {
            return u.url;
          }
        });

      instructions.push({
        priority: 'medium',
        category: 'internal_links',
        instruction: `Add internal links to at least 3 relevant pages on the site. Each link should have a descriptive title attribute. Suggested pages to link to: ${siteUrls.join(', ')}. Use target keywords as anchor text where natural.`,
        current_state: 'Fewer than 3 internal links on the page',
        target_state: 'At least 3 internal links with title attributes',
      });
    }

    // External links
    if (pageResult.issues?.some((i: string) => i.includes('external link') || i.includes('nofollow'))) {
      instructions.push({
        priority: 'medium',
        category: 'external_links',
        instruction: 'Add at least 1 external link to a relevant, authoritative source. The link must have rel="nofollow" and target="_blank". Choose a source that adds credibility to the page content (e.g., a government health agency for pest control, an industry association, or a research publication).',
        current_state: 'No external link with rel="nofollow" and target="_blank"',
        target_state: 'At least 1 external link to an authoritative source with rel="nofollow" target="_blank"',
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    instructions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    logger.info('Optimization instructions generated', {
      url_path: params.url_path,
      instructions_count: instructions.length,
    });

    return {
      url: params.url_path,
      word_count: wordCount,
      audit_score: pageResult.score,
      total_instructions: instructions.length,
      constraint: 'DO NOT change the content structure (headings, sections, page flow). Only modify text within existing sections, add formatting, and add links.',
      instructions,
      keywords_audited: keywords.map((kw: any) => ({
        keyword: kw.keyword,
        role: kw.keyword_role,
        density: `${Number(kw.actual_density).toFixed(2)}% (target: ${kw.target_density}%)`,
        in_title: kw.in_title,
        in_h1: kw.in_h1,
        in_meta_description: kw.in_meta_description,
        overall_pass: kw.overall_pass,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to generate optimization instructions', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to optimize content: ${message}` };
  }
}
