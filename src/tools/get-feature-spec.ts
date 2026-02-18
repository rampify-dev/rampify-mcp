/**
 * MCP Tool: get_feature_spec
 * Retrieve a feature specification from the Rampify database.
 *
 * Use this when starting work on a feature — retrieve the spec to understand
 * what to build, which files to touch, and what the acceptance criteria are.
 *
 * Supports two lookup modes:
 *   - spec_id: direct lookup (fastest, most precise)
 *   - search: keyword search across title + description (returns list of matches)
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const GetFeatureSpecInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Project UUID — use instead of domain when the domain is not registered as a client.'),

  // Lookup mode (one of these is required)
  spec_id: z
    .string()
    .optional()
    .describe('UUID of the specific feature spec to retrieve. Returns full spec with criteria and tasks.'),
  search: z
    .string()
    .optional()
    .describe('Keyword to search across spec titles and descriptions. Returns a list of matching specs.'),

  // Options (only apply when using spec_id)
  include_criteria: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include acceptance criteria in the response (default: true)'),
  include_tasks: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include implementation tasks in the response (default: true)'),
});

export type GetFeatureSpecParams = z.infer<typeof GetFeatureSpecInput>;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function getFeatureSpec(params: GetFeatureSpecParams): Promise<any> {
  const domain = params.domain || config.defaultDomain;

  if (!params.spec_id && !params.search) {
    return { error: 'Provide either spec_id (for a specific spec) or search (keyword lookup).' };
  }

  logger.info('Getting feature spec', {
    domain,
    project_id: params.project_id,
    spec_id: params.spec_id,
    search: params.search,
  });

  try {
    // ── Resolve site ID ───────────────────────────────────────────────────────
    let siteId: string;
    let clientId: string;

    if (params.project_id) {
      siteId = params.project_id;
      const siteData = await apiClient.get<any>(`/api/sites/${params.project_id}`);
      clientId = siteData?.client_id || '';
    } else {
      if (!domain) {
        return {
          error: 'No domain or project_id specified. Provide domain, project_id, or set SEO_CLIENT_DOMAIN.',
        };
      }
      const client = await apiClient.getClientByDomain(domain);
      if (!client) {
        return { error: `No project found for domain "${domain}". Add this site in the Rampify dashboard first.` };
      }
      const site = Array.isArray(client.sites) ? client.sites[0] : (client as any).sites;
      if (!site) {
        return { error: `No site configured for "${domain}". Run a site analysis in the dashboard first.` };
      }
      siteId = site.id;
      clientId = client.id;
    }

    const baseUrl = config.backendApiUrl.replace('/api', '');

    // ── spec_id: fetch single spec with full details ───────────────────────────
    if (params.spec_id) {
      const qs = new URLSearchParams({
        include_criteria: String(params.include_criteria ?? true),
        include_tasks: String(params.include_tasks ?? true),
      });

      const data = await apiClient.get<any>(
        `/api/sites/${siteId}/feature-specs/${params.spec_id}?${qs}`
      );

      if (!data?.spec) {
        return { error: `Feature spec "${params.spec_id}" not found.` };
      }

      const dashboardUrl = clientId
        ? `${baseUrl}/clients/${clientId}/features/${data.spec.id}`
        : `${baseUrl}/features/${data.spec.id}`;

      logger.info('Feature spec retrieved', { specId: data.spec.id });

      return {
        spec: data.spec,
        criteria: data.criteria ?? [],
        tasks: data.tasks ?? [],
        dashboard_url: dashboardUrl,
        // Surface the most actionable fields at the top level for quick AI consumption
        summary: {
          title: data.spec.title,
          status: data.spec.status,
          priority: data.spec.priority,
          next_action: data.spec.next_action,
          tasks_total: (data.tasks ?? []).length,
          tasks_completed: (data.tasks ?? []).filter((t: any) => t.status === 'completed').length,
          criteria_total: (data.criteria ?? []).length,
        },
      };
    }

    // ── search: return list of matching specs ─────────────────────────────────
    const qs = new URLSearchParams({ search: params.search! });
    const data = await apiClient.get<any>(`/api/sites/${siteId}/feature-specs?${qs}`);
    const specs: any[] = data?.specs ?? [];

    if (specs.length === 0) {
      return { message: `No feature specs found matching "${params.search}".`, specs: [] };
    }

    return {
      message: `Found ${specs.length} spec${specs.length !== 1 ? 's' : ''} matching "${params.search}". Use spec_id to retrieve full details for a specific spec.`,
      specs: specs.map((s: any) => ({
        spec_id: s.id,
        title: s.title,
        status: s.status,
        priority: s.priority,
        feature_type: s.feature_type,
        next_action: s.next_action,
        tasks_count: s.tasks_count,
        completed_tasks_count: s.completed_tasks_count,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to get feature spec', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to get feature spec: ${message}` };
  }
}
