'use client';

import { apiFetch } from '@/lib/api-fetch';
import type { Program } from '@/types';

export async function getPrograms(workspaceId: string): Promise<Program[]> {
  const res = await apiFetch(`/api/programs?workspace_id=${encodeURIComponent(workspaceId)}`);
  if (!res.ok) return [];
  const { programs } = await res.json();
  return programs ?? [];
}

export async function createProgram(workspaceId: string, name: string): Promise<Program> {
  const res = await apiFetch('/api/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to create program');
  return body.program as Program;
}

export async function renameProgram(programId: string, name: string): Promise<Program> {
  const res = await apiFetch(`/api/programs/${programId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to rename program');
  return body.program as Program;
}

export async function deleteProgram(programId: string): Promise<void> {
  await apiFetch(`/api/programs/${programId}`, { method: 'DELETE' });
}

export async function addBoardToProgram(programId: string, boardId: string): Promise<void> {
  await apiFetch(`/api/programs/${programId}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board_id: boardId }),
  });
}

export async function removeBoardFromProgram(programId: string, boardId: string): Promise<void> {
  await apiFetch(`/api/programs/${programId}/boards?board_id=${boardId}`, { method: 'DELETE' });
}
