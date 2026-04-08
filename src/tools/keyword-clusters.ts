/**
 * MCP Tools: Keyword Clusters
 *
 * create_keyword_cluster: Create a strategic keyword cluster with content brief
 * get_keyword_clusters: Retrieve all clusters for a project with keywords and volume data
 *
 * Workflow: user discusses keyword strategy with AI → AI researches keywords →
 * AI creates clusters with strategic context → clusters guide site building
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// ─── Create Keyword Cluster ──────────────────────────────────────────────────

export const CreateKeywordClusterInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Project UUID — use instead of domain when no domain is configured.'),
  name: z
    .string()
    .describe('Cluster name (e.g., "Pain Point / Problem-Aware", "Rodent Control Toronto")'),
  description: z
    .string()
    .optional()
    .describe('Strategic rationale — why target this cluster? (e.g., "Proven search demand, no tool owns the solution yet")'),
  priority: z
    .enum(['critical', 'high', 'normal', 'low'])
    .optional()
    .default('normal')
    .describe('Cluster priority'),
  competitive_landscape: z
    .string()
    .optional()
    .describe('What currently ranks, who the competitors are, positioning gaps'),
  notes: z
    .string()
    .optional()
    .describe('Free-form strategic notes'),
  target_content_type: z
    .string()
    .optional()
    .describe('Recommended content type: blog_post, landing_page, guide, authority_page, tool_page, feature_page'),
  target_url: z
    .string()
    .optional()
    .describe('Target page URL path (e.g., "/blog/my-post"). Leave empty if page needs to be created.'),
  keywords: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Keywords to assign to this cluster. New keywords are auto-created as target keywords.'),
});

export type CreateKeywordClusterParams = z.infer<typeof CreateKeywordClusterInput>;

export async function createKeywordCluster(params: CreateKeywordClusterParams): Promise<any> {
  if (!params.name) {
    return { error: 'name is required.' };
  }

  const domain = params.domain || config.defaultDomain;

  logger.info('Creating keyword cluster', { domain, name: params.name });

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
      `/api/sites/${siteId}/keyword-clusters`,
      {
        name: params.name,
        description: params.description || undefined,
        priority: params.priority,
        competitive_landscape: params.competitive_landscape || undefined,
        notes: params.notes || undefined,
        target_content_type: params.target_content_type || undefined,
        target_url: params.target_url || undefined,
        keywords: params.keywords,
      }
    );

    if (!data?.success) {
      return { error: data?.error ?? 'Failed to create cluster.' };
    }

    logger.info('Keyword cluster created', { name: params.name, id: data.cluster?.id });

    return {
      success: true,
      cluster: {
        id: data.cluster.id,
        name: data.cluster.name,
        priority: data.cluster.priority,
        status: data.cluster.status,
        target_content_type: data.cluster.target_content_type,
        keywords_assigned: data.keywords_assigned || 0,
        keywords_created: data.keywords_created || 0,
      },
    };
  } catch (error: any) {
    logger.error('Failed to create keyword cluster', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to create keyword cluster: ${message}` };
  }
}

// ─── Get Keyword Clusters ────────────────────────────────────────────────────

export const GetKeywordClustersInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Project UUID — use instead of domain when no domain is configured.'),
});

export type GetKeywordClustersParams = z.infer<typeof GetKeywordClustersInput>;

export async function getKeywordClusters(params: GetKeywordClustersParams): Promise<any> {
  const domain = params.domain || config.defaultDomain;

  logger.info('Getting keyword clusters', { domain });

  try {
    const resolved = await apiClient.resolveSiteAndClient({
      projectId: params.project_id || config.defaultProjectId,
      domain,
    });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId } = resolved;

    const data = await apiClient.get<any>(`/api/sites/${siteId}/keyword-clusters`);

    if (!data) {
      return { error: 'Failed to fetch clusters.' };
    }

    logger.info('Keyword clusters retrieved', { count: data.clusters?.length || 0 });

    return {
      clusters: (data.clusters || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        priority: c.priority,
        status: c.status,
        target_content_type: c.target_content_type,
        target_url: c.target_url,
        competitive_landscape: c.competitive_landscape,
        notes: c.notes,
        keyword_count: c.keyword_count,
        combined_volume: c.combined_volume,
        keywords: (c.keywords || []).map((k: any) => ({
          keyword: k.keyword,
          tier: k.tier,
          search_volume: k.search_volume,
          competition: k.competition,
          content_type: k.content_type,
        })),
      })),
      unclustered_count: data.unclustered?.length || 0,
      total_clusters: data.total,
    };
  } catch (error: any) {
    logger.error('Failed to get keyword clusters', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to get keyword clusters: ${message}` };
  }
}
