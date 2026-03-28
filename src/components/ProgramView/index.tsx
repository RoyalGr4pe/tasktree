'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTasks, getAssignees } from '@/services/tasks';
import { renameProgram, addBoardToProgram, removeBoardFromProgram } from '@/services/programs';
import { getUsers } from '@/services/users';
import type { Program, Board, Task, MondayUser } from '@/types';
import { computeRollups } from '@/lib/tree-utils';
import { BoardCard } from './BoardCard';
import { AddBoardPicker } from './AddBoardPicker';
import { SummaryStrip } from './SummaryStrip';

interface ProgramViewProps {
  program: Program;
  boards: Board[];
  workspace: { id: string };
  onBack: () => void;
  onProgramRenamed: (program: Program) => void;
  onProgramDeleted: (programId: string) => void;
}

export default function ProgramView({
  program,
  boards,
  onBack,
  onProgramRenamed,
  onProgramDeleted: _onProgramDeleted,
}: ProgramViewProps) {
  const [programName, setProgramName] = useState(program.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(program.name);

  const [memberBoardIds, setMemberBoardIds] = useState<string[]>(
    (program.program_boards ?? []).sort((a, b) => a.position - b.position).map((pb) => pb.board_id)
  );

  const [tasksByBoard, setTasksByBoard] = useState<Record<string, Task[]>>({});
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string[]>>({});
  const [mondayUsers, setMondayUsers] = useState<MondayUser[]>([]);
  const [loadingBoards, setLoadingBoards] = useState<Set<string>>(new Set());
  const [showAddPicker, setShowAddPicker] = useState(false);

  useEffect(() => {
    getUsers()
      .then((users) => setMondayUsers(users))
      .catch(() => {});
  }, []);

  const fetchBoard = useCallback(async (boardId: string) => {
    setLoadingBoards((prev) => new Set(prev).add(boardId));
    try {
      const [tasks, assignees] = await Promise.all([
        getTasks(boardId),
        getAssignees(boardId),
      ]);
      setTasksByBoard((prev) => ({ ...prev, [boardId]: tasks }));
      const map: Record<string, string[]> = {};
      for (const a of assignees) {
        if (!map[a.task_id]) map[a.task_id] = [];
        map[a.task_id].push(a.user_id);
      }
      setAssigneeMap((prev) => ({ ...prev, ...map }));
    } catch (err) {
      console.error('[ProgramView] Failed to load board:', boardId, err);
    } finally {
      setLoadingBoards((prev) => { const next = new Set(prev); next.delete(boardId); return next; });
    }
  }, []);

  useEffect(() => {
    for (const boardId of memberBoardIds) {
      if (!tasksByBoard[boardId]) fetchBoard(boardId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberBoardIds]);

  const rollupMapByBoard = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeRollups>> = {};
    for (const boardId of memberBoardIds) {
      result[boardId] = computeRollups(tasksByBoard[boardId] ?? []);
    }
    return result;
  }, [tasksByBoard, memberBoardIds]);

  const allTasks = useMemo(() => Object.values(tasksByBoard).flat(), [tasksByBoard]);
  const memberBoards = boards.filter((b) => memberBoardIds.includes(b.id));
  const availableBoards = boards.filter((b) => !memberBoardIds.includes(b.id));

  async function handleAddBoard(board: Board) {
    setMemberBoardIds((prev) => [...prev, board.id]);
    await addBoardToProgram(program.id, board.id)
      .catch((err) => console.error('[ProgramView] Failed to add board:', err));
    fetchBoard(board.id);
  }

  async function handleRemoveBoard(boardId: string) {
    setMemberBoardIds((prev) => prev.filter((id) => id !== boardId));
    await removeBoardFromProgram(program.id, boardId)
      .catch((err) => console.error('[ProgramView] Failed to remove board:', err));
  }

  async function commitRename() {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === programName) return;
    setProgramName(trimmed);
    try {
      const updated = await renameProgram(program.id, trimmed);
      onProgramRenamed(updated);
    } catch {
      setProgramName(programName);
    }
  }

  const isLoading = loadingBoards.size > 0 && allTasks.length === 0;

  return (
    <div className="flex flex-col min-h-screen font-sans text-monday-dark">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-10 mb-4">
        <button onClick={onBack} className="shrink-0 text-table-secondary hover:text-monday-dark transition-colors" title="Back">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <svg className="w-4 h-4 text-monday-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(programName); }
            }}
            className="text-sm font-semibold text-monday-dark bg-transparent border-b border-monday-blue outline-none w-48"
          />
        ) : (
          <span
            className="text-sm font-semibold text-monday-dark cursor-pointer hover:text-monday-blue transition-colors"
            onDoubleClick={() => { setRenameValue(programName); setIsRenaming(true); }}
            title="Double-click to rename"
          >
            {programName}
          </span>
        )}

        <span className="text-xs font-medium text-table-foreground bg-badge-bg rounded-full px-2 py-0.5 leading-none">
          {memberBoards.length} board{memberBoards.length !== 1 ? 's' : ''}
        </span>

        <div className="flex-1" />

        <div className="relative">
          {memberBoards.length === 0 ? (
            <button
              onClick={() => setShowAddPicker((v) => !v)}
              className="shrink-0 flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium text-monday-blue bg-monday-blue/10 hover:bg-monday-blue/20 rounded-lg transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add board
            </button>
          ) : (
            <button
              onClick={() => setShowAddPicker((v) => !v)}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-table-secondary hover:text-foreground hover:bg-badge-bg transition-colors"
              title="Add board"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          {showAddPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAddPicker(false)} />
              <div className="absolute right-0 top-8 z-50">
                <AddBoardPicker
                  available={availableBoards}
                  onAdd={handleAddBoard}
                  onClose={() => setShowAddPicker(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pb-8">
        {memberBoards.length > 0 && !isLoading && (
          <SummaryStrip allTasks={allTasks} assigneeMap={assigneeMap} memberBoards={memberBoards} />
        )}

        {memberBoards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <svg className="w-12 h-12 text-border-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div>
              <p className="text-sm font-medium text-monday-dark">No boards in this portfolio</p>
              <p className="text-xs text-icon-muted mt-0.5">Click &ldquo;Add board&rdquo; to include boards from your workspace</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {memberBoards.map((board) => (
              <div key={board.id} className="relative">
                {loadingBoards.has(board.id) && (
                  <div className="absolute inset-0 bg-surface/70 rounded-xl flex items-center justify-center z-10">
                    <div className="w-4 h-4 border-2 border-monday-blue border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <BoardCard
                  board={board}
                  tasks={tasksByBoard[board.id] ?? []}
                  rollupMap={rollupMapByBoard[board.id] ?? new Map()}
                  mondayUsers={mondayUsers}
                  assigneeMap={assigneeMap}
                  onRemove={handleRemoveBoard}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
