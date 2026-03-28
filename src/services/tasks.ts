'use client';

import { apiFetch } from '@/lib/api-fetch';
import type { Task, TaskAssignee, TaskDependency, PatchTaskPayload } from '@/types';

export async function getTasks(boardId: string): Promise<Task[]> {
  const res = await apiFetch(`/api/tasks?board_id=${encodeURIComponent(boardId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Failed to load tasks');
  }
  const { tasks } = await res.json();
  return tasks as Task[];
}

export async function getTaskCounts(workspaceId: string): Promise<Record<string, number>> {
  const res = await apiFetch(`/api/tasks/counts?workspace_id=${encodeURIComponent(workspaceId)}`);
  if (!res.ok) return {};
  const { counts } = await res.json();
  return counts ?? {};
}

export async function createTask(payload: {
  board_id: string;
  workspace_id: string;
  parent_task_id: string | null;
  title: string;
  status: string | null;
}): Promise<Task> {
  const res = await apiFetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error ?? 'Failed to create task'), { status: res.status, body });
  return body.task as Task;
}

export async function patchTask(id: string, patch: Partial<Pick<Task, 'title' | 'priority' | 'status' | 'due_date' | 'estimate_hours'>>): Promise<void> {
  const res = await apiFetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Failed to update task');
  }
}

export async function patchTaskPosition(payload: PatchTaskPayload): Promise<void> {
  const res = await apiFetch(`/api/tasks/${payload.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parent_task_id: payload.parent_task_id,
      position: payload.position,
      depth: payload.depth,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'PATCH failed');
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Delete failed');
  }
}

// ---------------------------------------------------------------------------
// Assignees
// ---------------------------------------------------------------------------

export async function getAssignees(boardId: string): Promise<(TaskAssignee & { task_id: string })[]> {
  const res = await apiFetch(`/api/tasks/assignees?board_id=${encodeURIComponent(boardId)}`);
  const { assignees } = await res.json();
  return assignees ?? [];
}

export async function assignUser(taskId: string, userId: string, workspaceId: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${taskId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, workspaceId }),
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error ?? 'Failed to assign'), { status: res.status, body });
}

export async function unassignUser(taskId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${taskId}/assign/${userId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Failed to unassign');
  }
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export async function getDependencies(boardId: string): Promise<TaskDependency[]> {
  const res = await apiFetch(`/api/tasks/dependencies?board_id=${encodeURIComponent(boardId)}`);
  const { dependencies } = await res.json();
  return dependencies ?? [];
}

export async function addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${taskId}/dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depends_on_task_id: dependsOnTaskId }),
  });
  if (!res.ok) throw new Error('Failed to add dependency');
}

export async function removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
  await apiFetch(`/api/tasks/${taskId}/dependencies?depends_on_task_id=${dependsOnTaskId}`, {
    method: 'DELETE',
  });
}
