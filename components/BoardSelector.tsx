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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { Board, Workspace, Program } from '@/types';
import { PLAN_LIMITS } from '@/lib/plan-limits';

interface BoardSelectorProps {
    workspace: Workspace;
    boards: Board[];
    programs: Program[];
    onSelectBoard: (board: Board) => void;
    onBoardCreated: (board: Board) => void;
    onBoardRenamed: (board: Board) => void;
    onBoardDeleted: (boardId: string) => void;
    onSelectProgram: (program: Program) => void;
    onProgramCreated: (name: string) => void;
    onProgramDeleted: (programId: string) => void;
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
    programs,
    onSelectBoard,
    onBoardCreated,
    onBoardRenamed,
    onBoardDeleted,
    onSelectProgram,
    onProgramCreated,
    onProgramDeleted,
}: BoardSelectorProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [newProgramName, setNewProgramName] = useState('');
    const [showNewProgram, setShowNewProgram] = useState(false);
    const [renamingProgramId, setRenamingProgramId] = useState<string | null>(null);
    const [renameProgramValue, setRenameProgramValue] = useState('');
    const [pendingDeleteProgramId, setPendingDeleteProgramId] = useState<string | null>(null);

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

    async function commitProgramRename(program: Program) {
        const trimmed = renameProgramValue.trim();
        setRenamingProgramId(null);
        if (!trimmed || trimmed === program.name) return;
        const res = await fetch(`/api/programs/${program.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
        });
        if (res.ok) {
            const { program: updated } = await res.json();
            onSelectProgram(updated);
        }
    }

    async function confirmDeleteProgram(programId: string) {
        setPendingDeleteProgramId(null);
        await fetch(`/api/programs/${programId}`, { method: 'DELETE' });
        onProgramDeleted(programId);
    }

    const limits = PLAN_LIMITS[workspace.plan];
    const atBoardLimit = boards.length >= limits.maxBoards;
    const atProgramLimit = programs.length >= limits.maxPrograms;
    const programsDisabled = limits.maxPrograms === 0;

    return (
        <main className="min-h-screen bg-app-bg font-sans text-monday-dark flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-start pt-10 pb-16 px-4">

                <div className="w-full max-w-2xl">

                    {/* ── Boards section ── */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-semibold text-monday-dark">Boards</h2>
                            <button
                                onClick={() => setShowCreate(true)}
                                disabled={atBoardLimit}
                                title={atBoardLimit ? 'Board limit reached' : 'New board'}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-monday-blue hover:bg-monday-blue/10 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                New board
                            </button>
                        </div>

                        {boards.length === 0 ? (
                            <div className="border border-dashed border-border-subtle rounded-lg px-6 py-10 flex flex-col items-center text-center">
                                <p className="text-sm font-medium text-monday-dark mb-1">No boards yet</p>
                                <p className="text-xs text-monday-dark-secondary mb-4">
                                    A board holds all your tasks in a nested tree.
                                </p>
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="px-4 py-2 text-sm font-medium text-white bg-monday-blue rounded-lg hover:bg-monday-blue-hover transition-colors"
                                >
                                    Create your first board
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-border-subtle overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-badge-bg/50 hover:bg-badge-bg/50">
                                            <TableHead className="text-xs font-medium text-monday-dark-secondary py-2">Name</TableHead>
                                            <TableHead className="text-xs font-medium text-monday-dark-secondary py-2 text-right">Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {boards.map((board) => {
                                            const color = getBoardColor(board.id);
                                            const isRenaming = renamingId === board.id;
                                            return (
                                                <ContextMenu key={board.id}>
                                                    <ContextMenuTrigger asChild>
                                                        <TableRow
                                                            onClick={() => !isRenaming && onSelectBoard(board)}
                                                            className="cursor-pointer hover:bg-monday-blue/5 group"
                                                        >
                                                            <TableCell className="py-2.5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-7 h-7 rounded-md ${color} flex items-center justify-center shrink-0 text-white text-[10px] font-bold`}>
                                                                        <BoardInitials name={isRenaming ? renameValue : board.name} />
                                                                    </div>
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
                                                                            className="text-sm font-medium text-monday-dark bg-transparent border-b border-monday-blue outline-none"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-sm font-medium text-monday-dark">{board.name}</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2.5 text-right">
                                                                <span className="text-xs text-monday-dark-secondary">{formatDate(board.created_at)}</span>
                                                            </TableCell>
                                                        </TableRow>
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
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Plan usage bar */}
                        {limits.maxBoards !== Infinity && (
                            <div className="flex items-center gap-3 mt-2 px-0.5">
                                <div className="flex-1 h-1 bg-badge-bg rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-monday-blue rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (boards.length / limits.maxBoards) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-monday-dark-secondary whitespace-nowrap">
                                    <span className={atBoardLimit ? 'text-monday-error font-medium' : ''}>{boards.length}</span>
                                    {' / '}{limits.maxBoards} boards · <span className="font-medium capitalize">{workspace.plan}</span>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ── Portfolios section ── */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-monday-dark">Portfolios</h2>
                                <span className="text-xs text-monday-dark-secondary">— group boards for a cross-board overview</span>
                            </div>
                            {!programsDisabled && !atProgramLimit && (
                                <button
                                    onClick={() => setShowNewProgram(true)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-monday-blue hover:bg-monday-blue/10 rounded-md transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                    New portfolio
                                </button>
                            )}
                        </div>

                        <div className="rounded-lg border border-border-subtle overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-badge-bg/50 hover:bg-badge-bg/50">
                                        <TableHead className="text-xs font-medium text-monday-dark-secondary py-2">Name</TableHead>
                                        <TableHead className="text-xs font-medium text-monday-dark-secondary py-2 text-right">Boards</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {programs.map((program) => {
                                        const isRenamingThis = renamingProgramId === program.id;
                                        return (
                                            <ContextMenu key={program.id}>
                                                <ContextMenuTrigger asChild>
                                                    <TableRow
                                                        onClick={() => !isRenamingThis && onSelectProgram(program)}
                                                        className="cursor-pointer hover:bg-monday-blue/5 group"
                                                    >
                                                        <TableCell className="py-2.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-7 h-7 rounded-md bg-monday-blue/10 flex items-center justify-center shrink-0">
                                                                    <svg className="w-3.5 h-3.5 text-monday-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                    </svg>
                                                                </div>
                                                                {isRenamingThis ? (
                                                                    <input
                                                                        autoFocus
                                                                        value={renameProgramValue}
                                                                        onChange={(e) => setRenameProgramValue(e.target.value)}
                                                                        onBlur={() => commitProgramRename(program)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') commitProgramRename(program);
                                                                            if (e.key === 'Escape') setRenamingProgramId(null);
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="text-sm font-medium text-monday-dark bg-transparent border-b border-monday-blue outline-none"
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm font-medium text-monday-dark">{program.name}</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-right">
                                                            <span className="text-xs text-monday-dark-secondary">
                                                                {(program.program_boards ?? []).length}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                </ContextMenuTrigger>
                                                <ContextMenuContent className="w-44">
                                                    <ContextMenuItem
                                                        className="gap-2 text-xs"
                                                        onClick={(e) => { e.stopPropagation(); setRenameProgramValue(program.name); setRenamingProgramId(program.id); }}
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                        Rename
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem
                                                        className="gap-2 text-xs text-monday-error focus:text-monday-error focus:bg-monday-error/10"
                                                        onClick={(e) => { e.stopPropagation(); setPendingDeleteProgramId(program.id); }}
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

                                    {/* New program inline row */}
                                    {showNewProgram && (
                                        <TableRow>
                                            <TableCell colSpan={2} className="py-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Portfolio name…"
                                                        value={newProgramName}
                                                        onChange={(e) => setNewProgramName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && newProgramName.trim()) {
                                                                onProgramCreated(newProgramName.trim());
                                                                setNewProgramName('');
                                                                setShowNewProgram(false);
                                                            }
                                                            if (e.key === 'Escape') { setShowNewProgram(false); setNewProgramName(''); }
                                                        }}
                                                        className="flex-1 px-2 py-1 text-sm border border-monday-blue rounded-md outline-none bg-surface text-monday-dark"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (newProgramName.trim()) {
                                                                onProgramCreated(newProgramName.trim());
                                                                setNewProgramName('');
                                                                setShowNewProgram(false);
                                                            }
                                                        }}
                                                        className="px-3 py-1 text-xs font-medium text-white bg-monday-blue rounded-md hover:bg-monday-blue-hover transition-colors"
                                                    >
                                                        Create portfolio
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowNewProgram(false); setNewProgramName(''); }}
                                                        className="px-2 py-1 text-xs text-icon-muted hover:text-monday-dark transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}

                                    {/* Empty state */}
                                    {programs.length === 0 && !showNewProgram && (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={2} className="py-6 text-center">
                                                {programsDisabled ? (
                                                    <div className="flex items-center justify-center gap-2 text-icon-muted">
                                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                        </svg>
                                                        <span className="text-sm">Portfolios require</span>
                                                        <span className="text-xs font-semibold text-monday-blue bg-monday-blue/10 px-2 py-0.5 rounded-full">Pro or Business</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-monday-dark-secondary">No portfolios yet. Add one to see all your boards in one view.</p>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Portfolio limit notice */}
                        {!programsDisabled && atProgramLimit && (
                            <div className="flex items-center justify-between mt-2 px-0.5">
                                <span className="text-xs text-monday-dark-secondary">{programs.length}/{limits.maxPrograms} portfolios used</span>
                                <span className="text-xs font-semibold text-monday-blue bg-monday-blue/10 px-2 py-0.5 rounded-full">Upgrade for more</span>
                            </div>
                        )}
                    </div>

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

            <AlertDialog open={!!pendingDeleteProgramId} onOpenChange={(open) => { if (!open) setPendingDeleteProgramId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{programs.find((p) => p.id === pendingDeleteProgramId)?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this portfolio. Boards inside it will not be affected. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => pendingDeleteProgramId && confirmDeleteProgram(pendingDeleteProgramId)}
                            className="bg-monday-error hover:bg-monday-error/90 text-white"
                        >
                            Delete portfolio
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
