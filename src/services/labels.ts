'use client';

import { apiFetch } from '@/lib/api-fetch';
import type { Label } from '@/types';

export async function getLabels(workspaceId: string): Promise<Label[]> {
  const res = await apiFetch(`/api/labels?workspace_id=${encodeURIComponent(workspaceId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to load labels');
  return body.labels ?? [];
}

export async function createLabel(workspaceId: string, name: string, color: string): Promise<Label> {
  const res = await apiFetch('/api/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name, color }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to create label');
  return body.label as Label;
}

export async function getTaskLabels(boardId: string): Promise<{ task_id: string; label_id: string }[]> {
  const res = await apiFetch(`/api/task-labels?board_id=${encodeURIComponent(boardId)}`);
  const { taskLabels } = await res.json();
  return taskLabels ?? [];
}

export async function setTaskLabels(taskId: string, boardId: string, labelIds: string[]): Promise<void> {
  await apiFetch('/api/task-labels', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, board_id: boardId, label_ids: labelIds }),
  });
}
