/**
 * MCP Tool: update_feature_spec
 * Mark tasks and criteria as complete, update spec status, and advance next_action.
 *
 * Use this after completing a task described in a feature spec to keep the spec
 * in sync with actual progress. Returns a suggested git commit message.
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const UpdateFeatureSpecInput = z.object({
  spec_id: z
    .string()
    .describe('UUID of the feature spec to update (required)'),

  // Spec-level updates
  status: z
    .enum(['planned', 'in_progress', 'completed', 'verified', 'deprecated'])
    .optional()
    .describe('New status for the overall spec'),
  next_action: z
    .string()
    .optional()
    .describe('Manually override the next_action field. If omitted, it is auto-advanced after a task completion.'),

  // Task update
  task_id: z
    .string()
    .optional()
    .describe('UUID of the specific task to update (from the tasks array returned by get_feature_spec)'),
  task_status: z
    .enum(['todo', 'in_progress', 'completed', 'blocked'])
    .optional()
    .describe('New status for the task'),

  // Criterion update
  criterion_id: z
    .string()
    .optional()
    .describe('UUID of the specific criterion to update (from the criteria array returned by get_feature_spec)'),
  criterion_status: z
    .enum(['pending', 'implemented', 'tested', 'verified'])
    .optional()
    .describe('New status for the criterion'),
});

export type UpdateFeatureSpecParams = z.infer<typeof UpdateFeatureSpecInput>;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function updateFeatureSpec(params: UpdateFeatureSpecParams): Promise<any> {
  if (!params.spec_id) {
    return { error: 'spec_id is required.' };
  }

  if (!params.status && !params.task_id && !params.criterion_id && params.next_action === undefined) {
    return { error: 'Provide at least one of: status, task_id + task_status, criterion_id + criterion_status, or next_action.' };
  }

  if (params.task_id && !params.task_status) {
    return { error: 'task_status is required when task_id is provided.' };
  }

  if (params.criterion_id && !params.criterion_status) {
    return { error: 'criterion_status is required when criterion_id is provided.' };
  }

  logger.info('Updating feature spec', {
    spec_id: params.spec_id,
    status: params.status,
    task_id: params.task_id,
    task_status: params.task_status,
    criterion_id: params.criterion_id,
    criterion_status: params.criterion_status,
  });

  try {
    const body: Record<string, any> = {};
    if (params.status) body.status = params.status;
    if (params.next_action !== undefined) body.next_action = params.next_action;
    if (params.task_id) { body.task_id = params.task_id; body.task_status = params.task_status; }
    if (params.criterion_id) { body.criterion_id = params.criterion_id; body.criterion_status = params.criterion_status; }

    const data = await apiClient.patch<any>(
      `/api/feature-specs/${params.spec_id}`,
      body
    );

    if (!data?.success) {
      return { error: data?.error ?? 'Failed to update feature spec.' };
    }

    logger.info('Feature spec updated', { specId: params.spec_id });

    return {
      success: true,
      next_action: data.next_action,
      suggested_commit: data.suggested_commit,
      spec_id: params.spec_id,
    };
  } catch (error: any) {
    logger.error('Failed to update feature spec', error);
    const message =
      error?.response?.data?.error ||
      (error instanceof Error ? error.message : 'Unknown error');
    return { error: `Failed to update feature spec: ${message}` };
  }
}
