'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Board, Workspace } from '@/types';
import { PLAN_LIMITS } from '@/lib/plan-limits';

interface CreateBoardModalProps {
  open: boolean;
  workspace: Workspace;
  currentBoardCount: number;
  onClose: () => void;
  onCreated: (board: Board) => void;
}

export default function CreateBoardModal({
  open,
  workspace,
  currentBoardCount,
  onClose,
  onCreated,
}: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limits = PLAN_LIMITS[workspace.plan];
  const atLimit = currentBoardCount >= limits.maxBoards;

  async function handleCreate() {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    setError(null);

    try {
      const res = await apiFetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id, name: name.trim() }),
      });

      const body = await res.json();

      if (res.status === 403) {
        setError(`You've reached the board limit for the ${workspace.plan} plan.`);
        return;
      }

      if (!res.ok) {
        setError(body.error ?? 'Failed to create board.');
        return;
      }

      setName('');
      onCreated(body.board as Board);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setName('');
      setError(null);
      onClose();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>New board</AlertDialogTitle>
          <AlertDialogDescription>
            Give your board a name. You can rename it later.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {atLimit ? (
          <div className="py-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-3">
            You&apos;ve reached the <strong>{limits.maxBoards}-board limit</strong> on the{' '}
            <strong>{workspace.plan}</strong> plan. Upgrade to create more boards.
          </div>
        ) : (
          <div className="py-2">
            <input
              autoFocus
              type="text"
              placeholder="e.g. Q3 Roadmap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 text-sm border border-monday-border rounded-[4px] outline-none focus:border-monday-blue focus:ring-2 focus:ring-monday-blue/20"
              maxLength={100}
            />
            {error && <p className="mt-2 text-xs text-monday-error">{error}</p>}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          {!atLimit && (
            <button
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
              className="px-4 py-2 text-sm font-medium text-white bg-monday-blue rounded hover:bg-monday-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating…' : 'Create board'}
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
