'use client';

import { apiFetch } from '@/lib/api-fetch';
import type { Workspace } from '@/types';

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const res = await apiFetch(`/api/workspaces?workspace_id=${encodeURIComponent(workspaceId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Failed to load workspace');
  }
  const { workspace } = await res.json();
  return workspace as Workspace;
}
