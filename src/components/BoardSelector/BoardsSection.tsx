'use client';

import { useState } from 'react';
import { renameBoard, deleteBoard } from '@/services/boards';
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
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Board, Workspace } from '@/types';
import type { PlanLimits } from '@/lib/plan-limits';
import { LimitGuard } from '@/guards';
import { BoardRow } from './BoardRow';
import CreateBoardModal from '@/components/CreateBoardModal';

interface BoardsSectionProps {
    workspace: Workspace;
    boards: Board[];
    limits: PlanLimits;
    onBoardCreated: (board: Board) => void;
    onBoardRenamed: (board: Board) => void;
    onBoardDeleted: (boardId: string) => void;
    onSelectBoard: (board: Board) => void;
}

export function BoardsSection({
    workspace,
    boards,
    limits,
    onBoardCreated,
    onBoardRenamed,
    onBoardDeleted,
    onSelectBoard,
}: BoardsSectionProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    async function commitRename(board: Board) {
        const trimmed = renameValue.trim();
        setRenamingId(null);
        if (!trimmed || trimmed === board.name) return;
        const updated = await renameBoard(board.id, trimmed);
        onBoardRenamed(updated);
    }

    async function confirmDelete(boardId: string) {
        setPendingDeleteId(null);
        await deleteBoard(boardId);
        onBoardDeleted(boardId);
    }

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-monday-dark">Boards</h2>
                <LimitGuard
                    current={boards.length}
                    limit={limits.maxBoards}
                    plan={workspace.plan}
                    resourceLabel="board"
                    showUsage={false}
                    showAtLimitMessage={false}
                >
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-monday-blue hover:bg-monday-blue/10 rounded-md transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        New board
                    </button>
                </LimitGuard>
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
                <div className="rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-badge-bg/50 hover:bg-badge-bg/50">
                                <TableHead className="text-xs font-medium text-monday-dark-secondary py-2">Name</TableHead>
                                <TableHead className="text-xs font-medium text-monday-dark-secondary py-2 text-right">Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {boards.map((board) => (
                                <BoardRow
                                    key={board.id}
                                    board={board}
                                    isRenaming={renamingId === board.id}
                                    renameValue={renameValue}
                                    onRenameChange={setRenameValue}
                                    onRenameCommit={() => commitRename(board)}
                                    onRenameCancel={() => setRenamingId(null)}
                                    onRenameStart={() => { setRenameValue(board.name); setRenamingId(board.id); }}
                                    onDeleteRequest={() => setPendingDeleteId(board.id)}
                                    onSelect={() => onSelectBoard(board)}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {limits.maxBoards !== Infinity && (
                <div className="mt-2 px-0.5">
                    <LimitGuard
                        current={boards.length}
                        limit={limits.maxBoards}
                        plan={workspace.plan}
                        resourceLabel="board"
                        showUsage={true}
                    >
                        <span />
                    </LimitGuard>
                </div>
            )}

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
        </div>
    );
}
