'use client';

import { useState } from 'react';
import CreateBoardModal from './CreateBoardModal';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Board, Workspace } from '@/types';
import { PLAN_LIMITS } from '@/lib/plan-limits';

interface BoardSelectorProps {
    workspace: Workspace;
    boards: Board[];
    onSelectBoard: (board: Board) => void;
    onBoardCreated: (board: Board) => void;
    onBoardRenamed: (board: Board) => void;
    onBoardDeleted: (boardId: string) => void;
}

const BOARD_COLORS = [
    'bg-blue-500',
    'bg-violet-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-fuchsia-500',
    'bg-orange-500',
];

function getBoardColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return BOARD_COLORS[Math.abs(hash) % BOARD_COLORS.length];
}

function BoardInitials({ name }: { name: string }) {
    const words = name.trim().split(/\s+/);
    const initials = words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
    return <>{initials}</>;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export default function BoardSelector({
    workspace,
    boards,
    onSelectBoard,
    onBoardCreated,
    onBoardRenamed,
    onBoardDeleted,
}: BoardSelectorProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    async function commitRename(board: Board) {
        const trimmed = renameValue.trim();
        setRenamingId(null);
        if (!trimmed || trimmed === board.name) return;
        const res = await fetch(`/api/boards/${board.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
        });
        if (res.ok) {
            const { board: updated } = await res.json();
            onBoardRenamed(updated);
        }
    }

    async function confirmDelete(boardId: string) {
        setPendingDeleteId(null);
        await fetch(`/api/boards/${boardId}`, { method: 'DELETE' });
        onBoardDeleted(boardId);
    }

    const limits = PLAN_LIMITS[workspace.plan];
    const atBoardLimit = boards.length >= limits.maxBoards;
    const isEmpty = boards.length === 0;

    return (
        <main className="min-h-screen bg-app-bg font-sans text-monday-dark flex flex-col">

            <div className="flex-1 flex flex-col items-center justify-start pt-10 pb-16 px-4">

                {/* Hero heading */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-monday-dark mb-1">
                        {isEmpty ? 'Welcome to TaskTree' : 'Your boards'}
                    </h1>
                    <p className="text-sm text-monday-dark-secondary">
                        {isEmpty
                            ? 'Create your first board to organise your tasks in a tree view.'
                            : 'Pick a board to open, or create a new one.'}
                    </p>
                </div>

                {/* Board grid */}
                {!isEmpty && (
                    <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {boards.map((board) => {
                            const color = getBoardColor(board.id);
                            const isRenaming = renamingId === board.id;
                            return (
                                <ContextMenu key={board.id}>
                                    <ContextMenuTrigger asChild>
                                        <div
                                            onClick={() => !isRenaming && onSelectBoard(board)}
                                            className="group relative text-left bg-surface border border-border-subtle rounded-xl p-4 transition-all duration-150 hover:border-monday-blue/40 hover:shadow-md cursor-pointer"
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Color avatar */}
                                                <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm`}>
                                                    <BoardInitials name={isRenaming ? renameValue : board.name} />
                                                </div>

                                                {/* Text */}
                                                <div className="flex-1 min-w-0 pt-0.5">
                                                    {isRenaming ? (
                                                        <input
                                                            autoFocus
                                                            value={renameValue}
                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                            onBlur={() => commitRename(board)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') commitRename(board);
                                                                if (e.key === 'Escape') setRenamingId(null);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-sm font-semibold text-monday-dark bg-transparent border-b border-monday-blue outline-none w-full"
                                                        />
                                                    ) : (
                                                        <p className="text-sm font-semibold text-monday-dark truncate leading-tight">
                                                            {board.name}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-monday-dark-secondary mt-0.5">
                                                        Created {formatDate(board.created_at)}
                                                    </p>
                                                </div>

                                                {/* Three-dot menu trigger hint */}
                                                <div className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-icon-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent className="w-44">
                                        <ContextMenuItem
                                            className="gap-2 text-xs"
                                            onClick={(e) => { e.stopPropagation(); setRenameValue(board.name); setRenamingId(board.id); }}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                            Rename
                                        </ContextMenuItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                            className="gap-2 text-xs text-monday-error focus:text-monday-error focus:bg-monday-error/10"
                                            onClick={(e) => { e.stopPropagation(); setPendingDeleteId(board.id); }}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete
                                        </ContextMenuItem>
                                    </ContextMenuContent>
                                </ContextMenu>
                            );
                        })}
                    </div>
                )}

                {/* Empty state */}
                {isEmpty && (
                    <div className="w-full max-w-sm mb-6">
                        <div className="bg-surface border-2 border-dashed border-border-subtle rounded-2xl px-8 py-12 flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-2xl bg-monday-blue/10 flex items-center justify-center mb-4">
                                <svg className="w-7 h-7 text-monday-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-monday-dark mb-1">No boards yet</p>
                            <p className="text-xs text-monday-dark-secondary">
                                A board holds all your tasks in a nested tree. Create one to get started.
                            </p>
                        </div>
                    </div>
                )}

                {/* New board button */}
                <div className="w-full max-w-2xl">
                    <button
                        onClick={() => setShowCreate(true)}
                        disabled={atBoardLimit}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-monday-blue border-2 border-dashed border-monday-blue/50 rounded-xl hover:bg-monday-blue/10 hover:border-monday-blue/90 hover:text-monday-blue transition-all duration-150 disabled:text-monday-blue/30 disabled:border-monday-blue/30 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        New board
                    </button>

                    {/* Plan usage */}
                    {limits.maxBoards !== Infinity && (
                        <div className="flex items-center justify-between mt-3 px-1">
                            <div className="flex-1 h-1 bg-badge-bg rounded-full overflow-hidden mr-3">
                                <div
                                    className="h-full bg-monday-blue rounded-full transition-all"
                                    style={{ width: `${Math.min(100, (boards.length / limits.maxBoards) * 100)}%` }}
                                />
                            </div>
                            <span className="text-xs text-monday-dark-secondary whitespace-nowrap">
                                <span className={atBoardLimit ? 'text-monday-error font-medium' : ''}>
                                    {boards.length}
                                </span>
                                {' / '}
                                {limits.maxBoards} boards
                                {' · '}
                                <span className="font-medium capitalize">{workspace.plan}</span>
                            </span>
                        </div>
                    )}
                </div>

            </div>

            <CreateBoardModal
                open={showCreate}
                workspace={workspace}
                currentBoardCount={boards.length}
                onClose={() => setShowCreate(false)}
                onCreated={(board) => {
                    setShowCreate(false);
                    onBoardCreated(board);
                }}
            />

            <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{boards.find((b) => b.id === pendingDeleteId)?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this board and all its tasks. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => pendingDeleteId && confirmDelete(pendingDeleteId)}
                            className="bg-monday-error hover:bg-monday-error/90 text-white"
                        >
                            Delete board
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
