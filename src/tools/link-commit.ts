/**
 * MCP Tool: link_commit
 * Link a git commit SHA to a feature spec (and optionally a task).
 *
 * Deterministic workflow for AI agents:
 * 1. Retrieve spec context via get_feature_spec (spec_id is now in context)
 * 2. Implement changes and commit code
 * 3. Run `git rev-parse HEAD` to capture the exact SHA
 * 4. Run `git remote get-url origin` to get the repo URL
 * 5. Call this tool with the SHA, repo_url, and spec_id/task_id
 *
 * This creates full traceability: code -> commit -> task -> spec -> requirement.
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const LinkCommitInput = z.object({
  domain: z
    .string()
    .optional()
    .describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  project_id: z
    .string()
    .optional()
    .describe('Project UUID — use instead of domain when no domain is configured.'),
  spec_id: z
    .string()
    .describe('UUID of the feature spec to link the commit to (required)'),
  task_id: z
    .string()
    .optional()
    .describe('UUID of the specific task to link the commit to. If provided, the commit is linked to both the task and its parent spec.'),
  commit_sha: z
    .string()
    .describe('Git commit SHA to link (from `git rev-parse HEAD` after committing)'),
  repo_url: z
    .string()
    .optional()
    .describe('Repository HTTPS URL (e.g., "https://github.com/owner/repo"). Derive from `git remote get-url origin` and normalize SSH to HTTPS. Enables clickable commit links in the dashboard.'),
});

export type LinkCommitParams = z.infer<typeof LinkCommitInput>;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function linkCommit(params: LinkCommitParams): Promise<any> {
  if (!params.spec_id) {
    return { error: 'spec_id is required.' };
  }

  if (!params.commit_sha) {
    return { error: 'commit_sha is required.' };
  }

  // Validate SHA format
  if (!/^[a-f0-9]{7,40}$/i.test(params.commit_sha)) {
    return { error: 'Invalid commit SHA format. Expected 7-40 hex characters.' };
  }

  const domain = params.domain || config.defaultDomain;

  logger.info('Linking commit to spec', {
    spec_id: params.spec_id,
    task_id: params.task_id,
    commit_sha: params.commit_sha.substring(0, 7),
  });

  try {
    // Resolve site ID
    const resolved = await apiClient.resolveSiteAndClient({
      projectId: params.project_id || config.defaultProjectId,
      domain,
    });

    if ('error' in resolved) {
      return { error: resolved.error };
    }

    const { siteId } = resolved;

    // POST to commits endpoint
    const data = await apiClient.post<any>(
      `/api/sites/${siteId}/feature-specs/${params.spec_id}/commits`,
      {
        commit_sha: params.commit_sha,
        ...(params.task_id ? { task_id: params.task_id } : {}),
        ...(params.repo_url ? { repo_url: params.repo_url } : {}),
      }
    );

    if (!data?.success) {
      return { error: data?.error ?? 'Failed to link commit.' };
    }

    logger.info('Commit linked', {
      spec_id: params.spec_id,
      commit_sha: params.commit_sha.substring(0, 7),
      total_commits: data.total_commits,
    });

    return {
      success: true,
      linked_to: data.linked_to,
      commit_sha: params.commit_sha,
      total_commits: data.total_commits,
    };
  } catch (error: any) {
    logger.error('Failed to link commit', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to link commit: ${message}` };
  }
}
