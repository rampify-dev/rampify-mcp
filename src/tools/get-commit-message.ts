/**
 * MCP Tool: get_commit_message
 * Generate a conventional-commits-style message from spec/task context.
 *
 * Derives the message from structured spec data already in the DB —
 * no external AI call needed. Returns a ready-to-use commit message string.
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const GetCommitMessageInput = z.object({
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
    .describe('UUID of the feature spec'),
  task_id: z
    .string()
    .optional()
    .describe('UUID of the specific task being completed (recommended for more precise messages)'),
  files_changed: z
    .array(z.string())
    .optional()
    .default([])
    .describe('List of files changed in this commit (for the message body)'),
});

export type GetCommitMessageParams = z.infer<typeof GetCommitMessageInput>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CommitType = 'feat' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore';

function deriveCommitType(featureType?: string, taskType?: string): CommitType {
  // Task type takes priority if available
  if (taskType) {
    switch (taskType) {
      case 'testing': return 'test';
      case 'docs': return 'docs';
      case 'database': return 'chore';
    }
  }

  // Fall back to feature type
  switch (featureType) {
    case 'bug_fix': return 'fix';
    case 'refactor': return 'refactor';
    case 'enhancement': return 'feat';
    case 'new_feature':
    default: return 'feat';
  }
}

function deriveScope(tags?: string[], techStack?: string[]): string | null {
  // Use first meaningful tag as scope
  const ignoreTags = new Set(['mcp', 'git', 'feature-specs', 'commit-integration', 'traceability', 'seo', 'scan-generated']);
  const scopeTag = tags?.find(t => !ignoreTags.has(t));
  if (scopeTag) return scopeTag;

  // Fall back to first tech stack item
  if (techStack?.length) {
    return techStack[0].toLowerCase().replace(/\s+/g, '-');
  }

  return null;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function getCommitMessage(params: GetCommitMessageParams): Promise<any> {
  if (!params.spec_id) {
    return { error: 'spec_id is required.' };
  }

  logger.info('Generating commit message', {
    spec_id: params.spec_id,
    task_id: params.task_id,
  });

  try {
    // Fetch spec details
    const qs = 'include_criteria=false&include_tasks=true';
    const data = await apiClient.get<any>(
      `/api/feature-specs/${params.spec_id}?${qs}`
    );

    if (!data?.spec) {
      return { error: 'Feature spec not found.' };
    }

    const spec = data.spec;
    const tasks = data.tasks || [];

    // Find the specific task if provided
    const task = params.task_id
      ? tasks.find((t: any) => t.id === params.task_id)
      : null;

    // Derive commit components
    const commitType = deriveCommitType(spec.feature_type, task?.task_type);
    const scope = deriveScope(spec.tags, spec.tech_stack);
    const subject = task ? task.title : spec.title;

    // Build the type(scope): subject line
    const header = scope
      ? `${commitType}(${scope}): ${subject}`
      : `${commitType}: ${subject}`;

    // Build body
    const bodyLines: string[] = [];
    if (task) {
      bodyLines.push(`Implements: ${task.title}`);
    }
    bodyLines.push(`Spec: ${spec.title}`);

    if (params.files_changed?.length) {
      bodyLines.push('');
      bodyLines.push('Files modified:');
      for (const file of params.files_changed) {
        bodyLines.push(`- ${file}`);
      }
    }

    // Footer with attribution
    const footer = 'Co-Authored-By: Claude <noreply@anthropic.com>';

    // Assemble full message
    const message = [header, '', ...bodyLines, '', footer].join('\n');

    logger.info('Commit message generated', {
      spec_id: params.spec_id,
      type: commitType,
    });

    return {
      message,
      conventional_commit: {
        type: commitType,
        scope: scope || undefined,
        subject,
        body: bodyLines.join('\n'),
        footer,
      },
      spec_id: spec.id,
      task_id: task?.id || undefined,
    };
  } catch (error: any) {
    logger.error('Failed to generate commit message', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to generate commit message: ${message}` };
  }
}
