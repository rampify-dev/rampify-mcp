/**
 * MCP Tool: list_feature_specs
 * Browse and filter all feature specifications for a project.
 *
 * Unlike get_feature_spec (which requires a spec_id or search keyword),
 * this tool returns all specs with optional filtering — the equivalent of
 * the VS Code extension's Feature Specs sidebar panel.
 *
 * Use this to get an overview of what's planned, in progress, or completed.
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const ListFeatureSpecsInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Project UUID — use instead of domain when no domain is configured. Uses RAMPIFY_PROJECT_ID env var if not provided.'),

  // Filters
  status: z
    .array(z.enum(['planned', 'in_progress', 'completed', 'verified', 'deprecated']))
    .optional()
    .describe('Filter by status (e.g., ["planned", "in_progress"]). Omit to return all.'),
  priority: z
    .array(z.enum(['critical', 'high', 'normal', 'low']))
    .optional()
    .describe('Filter by priority (e.g., ["critical", "high"]). Omit to return all.'),
  feature_type: z
    .array(z.enum(['new_feature', 'enhancement', 'refactor', 'bug_fix']))
    .optional()
    .describe('Filter by feature type. Omit to return all.'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Filter by tags (e.g., ["mcp-server", "frontend"]).'),
  module: z
    .enum(['seo', 'security', 'accessibility'])
    .optional()
    .describe('Filter by source module. Returns only scan-generated specs for that module.'),
  source: z
    .enum(['user', 'system', 'seo_scan', 'security_scan', 'accessibility_scan'])
    .optional()
    .describe('Filter by source (e.g., "user" for manual specs, "seo_scan" for scan findings).'),

  // Options
  include_stats: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include aggregate counts by status and priority (default: false).'),
});

export type ListFeatureSpecsParams = z.infer<typeof ListFeatureSpecsInput>;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function listFeatureSpecs(params: ListFeatureSpecsParams): Promise<any> {
  const domain = params.domain || config.defaultDomain;

  logger.info('Listing feature specs', {
    domain,
    project_id: params.project_id,
    status: params.status,
    priority: params.priority,
  });

  const baseUrl = config.backendApiUrl.replace('/api', '');

  try {
    const resolved = await apiClient.resolveSiteAndClient({
      projectId: params.project_id,
      domain,
    });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId, clientId } = resolved;

    // Build query params matching the backend API
    const qs = new URLSearchParams();

    if (params.status?.length) {
      qs.set('status', params.status.join(','));
    }
    if (params.priority?.length) {
      qs.set('priority', params.priority.join(','));
    }
    if (params.feature_type?.length) {
      qs.set('feature_type', params.feature_type.join(','));
    }
    if (params.tags?.length) {
      qs.set('tags', params.tags.join(','));
    }
    if (params.module) {
      qs.set('module', params.module);
    }
    if (params.source) {
      qs.set('source', params.source);
    }
    if (params.include_stats) {
      qs.set('include_stats', 'true');
    }

    const queryString = qs.toString();
    const url = `/api/sites/${siteId}/feature-specs${queryString ? `?${queryString}` : ''}`;

    const data = await apiClient.get<any>(url);
    const specs: any[] = data?.specs ?? [];

    logger.info('Feature specs listed', { count: specs.length });

    // Format specs for LLM consumption
    const formattedSpecs = specs.map((s: any) => ({
      spec_id: s.id,
      title: s.title,
      status: s.status,
      priority: s.priority,
      feature_type: s.feature_type,
      next_action: s.next_action,
      tasks_total: s.tasks_count ?? 0,
      tasks_completed: s.completed_tasks_count ?? 0,
      module: s.module ?? null,
      severity: s.severity ?? null,
      source: s.source ?? 'user',
      tags: s.tags ?? [],
      created_at: s.created_at,
    }));

    // Build filter description for context
    const activeFilters: string[] = [];
    if (params.status?.length) activeFilters.push(`status: ${params.status.join(', ')}`);
    if (params.priority?.length) activeFilters.push(`priority: ${params.priority.join(', ')}`);
    if (params.feature_type?.length) activeFilters.push(`type: ${params.feature_type.join(', ')}`);
    if (params.tags?.length) activeFilters.push(`tags: ${params.tags.join(', ')}`);

    const filterDesc = activeFilters.length
      ? ` (filtered by ${activeFilters.join('; ')})`
      : '';

    const result: any = {
      message: `${specs.length} feature spec${specs.length !== 1 ? 's' : ''}${filterDesc}. Use get_feature_spec with a spec_id to see full details, criteria, and tasks.`,
      specs: formattedSpecs,
      dashboard_url: `${baseUrl}/clients/${clientId}/features`,
    };

    if (params.include_stats && data?.stats) {
      result.stats = data.stats;
    }

    return result;
  } catch (error: any) {
    logger.error('Failed to list feature specs', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to list feature specs: ${message}` };
  }
}
