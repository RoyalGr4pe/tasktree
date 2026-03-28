'use client';

import { useState } from 'react';
import { createBoard } from '@/services/boards';
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
import { LimitGuard } from '@/guards';

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

    async function handleCreate() {
        if (!name.trim() || isCreating) return;
        setIsCreating(true);
        setError(null);

        try {
            const board = await createBoard(workspace.id, name.trim());
            setName('');
            onCreated(board);
        } catch (err: unknown) {
            const status = (err as { status?: number }).status;
            if (status === 403) {
                setError(`You've reached the board limit for the ${workspace.plan} plan.`);
                return;
            }
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
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

                <LimitGuard
                    current={currentBoardCount}
                    limit={limits.maxBoards}
                    plan={workspace.plan}
                    resourceLabel="board"
                    showUsage={false}
                >
                    <div className="py-2">
                        <input
                            autoFocus
                            type="text"
                            placeholder="e.g. Q3 Roadmap"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            className="w-full px-3 py-2 text-sm border border-monday-border rounded-lg outline-none focus:border-monday-blue focus:ring-2 focus:ring-monday-blue/20"
                            maxLength={100}
                        />
                        {error && <p className="mt-2 text-xs text-monday-error">{error}</p>}
                    </div>
                </LimitGuard>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
                    {currentBoardCount < limits.maxBoards && (
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
