/**
 * MCP Tool: create_feature_spec
 * Generate and save a feature specification to the Rampify database.
 *
 * Claude fills in all fields from codebase context before calling this tool.
 * The tool saves to the DB and returns the created spec with a dashboard link.
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// ─── Input Schema ────────────────────────────────────────────────────────────

const CriterionInput = z.object({
  title: z.string().describe('What must be true for this criterion to pass'),
  description: z.string().optional().describe('Additional detail or context'),
  criterion_type: z
    .enum(['functional', 'technical', 'performance', 'security', 'accessibility'])
    .optional()
    .default('functional'),
  verification_method: z
    .enum(['automated_test', 'manual_qa', 'code_review'])
    .optional()
    .default('manual_qa'),
  is_required: z.boolean().optional().default(true),
});

const TaskInput = z.object({
  title: z.string().describe('Concrete implementation step'),
  description: z.string().optional(),
  task_type: z
    .enum(['backend', 'frontend', 'database', 'testing', 'docs'])
    .optional()
    .default('frontend'),
  files_to_modify: z.array(z.string()).optional().default([]),
  code_snippet: z.string().optional().describe('Key code snippet or pseudocode for this task'),
});

export const CreateFeatureSpecInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Site UUID — use this instead of domain when the domain is not registered as a client (e.g., for the Rampify project itself). Find it in the dashboard URL: /clients/[clientId]/...'),

  // Core spec fields
  title: z.string().describe('Short, imperative title (e.g., "Add dark mode toggle")'),
  description: z
    .string()
    .optional()
    .describe('Full description of the feature, its purpose and user value'),
  feature_type: z
    .enum(['new_feature', 'enhancement', 'refactor', 'bug_fix'])
    .optional()
    .default('new_feature'),
  priority: z
    .enum(['critical', 'high', 'normal', 'low'])
    .optional()
    .default('normal'),

  // Context
  ai_context_summary: z
    .string()
    .optional()
    .describe('2-3 sentence summary of architecture decisions and approach for future AI agents'),
  next_action: z
    .string()
    .optional()
    .describe('The single next concrete step to start implementation'),

  // Metadata inferred from codebase
  tech_stack: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Technologies involved (e.g., ["Next.js", "Tailwind CSS", "Supabase"])'),
  affected_files: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Files that will be created or modified (relative paths)'),
  tags: z.array(z.string()).optional().default([]),

  // Structured acceptance criteria
  criteria: z
    .array(CriterionInput)
    .optional()
    .default([])
    .describe('Acceptance criteria that must pass for the feature to be complete'),

  // Implementation tasks
  tasks: z
    .array(TaskInput)
    .optional()
    .default([])
    .describe('Ordered implementation tasks with file references and code snippets'),
});

export type CreateFeatureSpecParams = z.infer<typeof CreateFeatureSpecInput>;

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function createFeatureSpec(
  params: CreateFeatureSpecParams
): Promise<{ success: true; spec: any; url: string } | { error: string }> {
  const domain = params.domain || config.defaultDomain;

  if (!domain) {
    return {
      error:
        'No domain specified. Either provide the domain parameter or set SEO_CLIENT_DOMAIN in the MCP config.',
    };
  }

  logger.info('Creating feature spec', { domain, project_id: params.project_id, title: params.title });

  try {
    // Resolve site ID — either directly provided or via domain lookup
    let siteId: string;
    let clientId: string;

    if (params.project_id) {
      siteId = params.project_id;
      // Fetch client via site to build dashboard URL
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
        return {
          error: `No project found for domain "${domain}". Add this site in the Rampify dashboard first.`,
        };
      }
      const site = Array.isArray(client.sites) ? client.sites[0] : (client as any).sites;
      if (!site) {
        return {
          error: `No site configured for "${domain}". Run a site analysis in the dashboard first.`,
        };
      }
      siteId = site.id;
      clientId = client.id;
    }

    // Build request body matching the POST /api/sites/[id]/feature-specs schema
    const body: Record<string, any> = {
      title: params.title,
      description: params.description || null,
      feature_type: params.feature_type,
      status: 'planned',
      priority: params.priority,
      tech_stack: params.tech_stack,
      affected_files: params.affected_files,
      tags: params.tags,
      ai_context_summary: params.ai_context_summary || null,
      next_action: params.next_action || null,
    };

    if (params.criteria && params.criteria.length > 0) {
      body.criteria = params.criteria;
    }

    if (params.tasks && params.tasks.length > 0) {
      body.tasks = params.tasks;
    }

    // POST to backend
    const response = await apiClient.post<{ spec: any }>(
      `/api/sites/${siteId}/feature-specs`,
      body
    );

    const created = response?.spec;
    if (!created) {
      return { error: 'Feature spec was not returned by the API.' };
    }

    // Build dashboard URL
    const baseUrl = config.backendApiUrl.replace('/api', '');
    const dashboardUrl = clientId
      ? `${baseUrl}/clients/${clientId}/features/${created.id}`
      : `${baseUrl}/features/${created.id}`;

    logger.info('Feature spec created', { specId: created.id, title: params.title });

    return {
      success: true,
      spec: {
        id: created.id,
        title: created.title,
        status: created.status,
        priority: created.priority,
        feature_type: created.feature_type,
        criteria_count: params.criteria?.length ?? 0,
        tasks_count: params.tasks?.length ?? 0,
        created_at: created.created_at,
      },
      url: dashboardUrl,
    };
  } catch (error: any) {
    logger.error('Failed to create feature spec', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to create feature spec: ${message}` };
  }
}
