'use client';

import { apiFetch } from '@/lib/api-fetch';
import type { Board } from '@/types';

export async function getBoards(workspaceId: string): Promise<Board[]> {
  const res = await apiFetch(`/api/boards?workspace_id=${encodeURIComponent(workspaceId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Failed to load boards');
  }
  const { boards } = await res.json();
  return boards as Board[];
}

export async function createBoard(workspaceId: string, name: string): Promise<Board> {
  const res = await apiFetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to create board');
  return body.board as Board;
}

export async function renameBoard(boardId: string, name: string): Promise<Board> {
  const res = await apiFetch(`/api/boards/${boardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to rename board');
  return body.board as Board;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await apiFetch(`/api/boards/${boardId}`, { method: 'DELETE' });
}
