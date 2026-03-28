'use client';

import { useState } from 'react';
import { deleteBoard } from '@/services/boards';
import { deleteProgram } from '@/services/programs';
import type { Board, Workspace, Program } from '@/types';
import { PLAN_LIMITS, UPGRADE_URL, getNextPlan, getPlanLabel } from '@/lib/plan-limits';

interface Violation {
  type: 'boards' | 'tasks' | 'portfolios';
  current: number;
  limit: number;
  board?: Board;       // set when type === 'tasks'
  programs?: Program[]; // set when type === 'portfolios'
}

interface PlanEnforcementModalProps {
  workspace: Workspace;
  boards: Board[];
  programs: Program[];
  /** taskCountByBoardId: map of boardId → task count */
  taskCountByBoardId: Record<string, number>;
  onBoardDeleted: (boardId: string) => void;
  onProgramDeleted: (programId: string) => void;
  onResolvedGoToBoard: (board: Board) => void;
}

export default function PlanEnforcementModal({
  workspace,
  boards,
  programs,
  taskCountByBoardId,
  onBoardDeleted,
  onProgramDeleted,
  onResolvedGoToBoard,
}: PlanEnforcementModalProps) {
  const limits = PLAN_LIMITS[workspace.plan];
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);

  // Compute all active violations
  const violations: Violation[] = [];

  if (boards.length > limits.maxBoards) {
    violations.push({ type: 'boards', current: boards.length, limit: limits.maxBoards });
  }

  for (const board of boards) {
    const count = taskCountByBoardId[board.id] ?? 0;
    if (count > limits.maxTasksPerBoard) {
      violations.push({ type: 'tasks', current: count, limit: limits.maxTasksPerBoard, board });
    }
  }

  if (limits.maxPrograms !== Infinity && programs.length > limits.maxPrograms) {
    violations.push({ type: 'portfolios', current: programs.length, limit: limits.maxPrograms, programs });
  }

  if (violations.length === 0) return null;

  async function handleDeleteBoard(boardId: string) {
    setDeletingId(boardId);
    try {
      await deleteBoard(boardId);
      onBoardDeleted(boardId);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteProgram(programId: string) {
    setDeletingProgramId(programId);
    try {
      await deleteProgram(programId);
      onProgramDeleted(programId);
    } finally {
      setDeletingProgramId(null);
    }
  }

  const planLabel = getPlanLabel(workspace.plan);
  const nextPlan = getNextPlan(workspace.plan);

  return (
    // Full-screen backdrop — no close on click
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-surface-overlay border border-border-input rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-subtle">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-monday-error/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-monday-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-monday-dark">Plan limit exceeded</h2>
              <p className="text-xs text-monday-dark-secondary mt-0.5">
                Your workspace is over the {planLabel} plan limits. Remove items below or upgrade to continue.
              </p>
            </div>
          </div>
        </div>

        {/* Violations */}
        <div className="px-6 py-4 flex flex-col gap-4 max-h-[50vh] overflow-y-auto">
          {violations.map((v, i) => (
            <div key={i} className="rounded-xl border border-border-subtle bg-surface p-4">
              {v.type === 'boards' ? (
                <BoardViolation
                  boards={boards}
                  limit={v.limit}
                  deletingId={deletingId}
                  onDelete={handleDeleteBoard}
                />
              ) : v.type === 'portfolios' ? (
                <PortfolioViolation
                  programs={v.programs!}
                  limit={v.limit}
                  deletingId={deletingProgramId}
                  onDelete={handleDeleteProgram}
                />
              ) : (
                <TaskViolation
                  board={v.board!}
                  current={v.current}
                  limit={v.limit}
                  onGoToBoard={() => onResolvedGoToBoard(v.board!)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Upgrade CTA */}
        <div className="px-6 py-4 border-t border-border-subtle bg-surface flex items-center justify-between gap-3">
          <p className="text-xs text-monday-dark-secondary">
            Upgrade to {nextPlan} to unlock higher limits.
          </p>
          <a
            href={UPGRADE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-4 py-1.5 text-xs font-semibold text-white bg-monday-blue rounded-lg hover:bg-monday-blue-hover transition-colors"
          >
            Upgrade →
          </a>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board violation — list boards over limit, let user delete them
// ---------------------------------------------------------------------------

function BoardViolation({
  boards,
  limit,
  deletingId,
  onDelete,
}: {
  boards: Board[];
  limit: number;
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  const excess = boards.length - limit;

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-monday-error shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <p className="text-xs font-semibold text-monday-dark">
          Too many boards — delete {excess} board{excess !== 1 ? 's' : ''}
        </p>
        <span className="ml-auto text-xs text-monday-error font-medium">{boards.length} / {limit}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {boards.map((board) => (
          <li key={board.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-overlay border border-border-subtle">
            <span className="flex-1 text-xs font-medium text-monday-dark truncate">{board.name}</span>
            <button
              onClick={() => onDelete(board.id)}
              disabled={deletingId === board.id}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-monday-error border border-monday-error/30 rounded-md hover:bg-monday-error/10 transition-colors disabled:opacity-40"
            >
              {deletingId === board.id ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              Delete
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// Task violation — tell user to open the board and delete tasks
// ---------------------------------------------------------------------------

function TaskViolation({
  board,
  current,
  limit,
  onGoToBoard,
}: {
  board: Board;
  current: number;
  limit: number;
  onGoToBoard: () => void;
}) {
  const excess = current - limit;

  return (
    <div className="flex items-start gap-3">
      <svg className="w-4 h-4 text-monday-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-monday-dark">
          Too many tasks in &ldquo;{board.name}&rdquo;
        </p>
        <p className="text-xs text-monday-dark-secondary mt-0.5">
          {current} tasks — delete at least {excess} task{excess !== 1 ? 's' : ''} to get within the {limit}-task limit.
        </p>
        <button
          onClick={onGoToBoard}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-monday-blue hover:underline"
        >
          Open board to delete tasks
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <span className="text-xs text-monday-error font-medium shrink-0">{current} / {limit}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portfolio violation — list portfolios over limit, let user delete them
// ---------------------------------------------------------------------------

function PortfolioViolation({
  programs,
  limit,
  deletingId,
  onDelete,
}: {
  programs: Program[];
  limit: number;
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  const excess = programs.length - limit;

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-monday-error shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-xs font-semibold text-monday-dark">
          Too many portfolios — delete {excess} portfolio{excess !== 1 ? 's' : ''}
        </p>
        <span className="ml-auto text-xs text-monday-error font-medium">{programs.length} / {limit}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {programs.map((program) => (
          <li key={program.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-overlay border border-border-subtle">
            <span className="flex-1 text-xs font-medium text-monday-dark truncate">{program.name}</span>
            <button
              onClick={() => onDelete(program.id)}
              disabled={deletingId === program.id}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-monday-error border border-monday-error/30 rounded-md hover:bg-monday-error/10 transition-colors disabled:opacity-40"
            >
              {deletingId === program.id ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              Delete
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
