'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import BoardSelector from '@/components/BoardSelector';
import PlanEnforcementModal from '@/components/PlanEnforcementModal';
import ProgramView from '@/components/ProgramView';
import type { Board, Task, Workspace, Program } from '@/types';
import { PLAN_LIMITS } from '@/lib/plan-limits';
import LoadingOne from '@/components/ui/loading';

const Tree = dynamic(() => import('@/components/Tree/Tree'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center py-10">
      <LoadingOne />
    </div>
  ),
});

type AppPhase =
  | 'init'       // resolving monday context + bootstrapping workspace
  | 'boards'     // showing board selector / empty state
  | 'loading'    // fetching tasks for selected board
  | 'ready'      // tree ready
  | 'program'    // viewing a program (cross-board)
  | 'error';

export default function BoardViewPage() {
  const [phase, setPhase] = useState<AppPhase>('init');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskCountByBoardId, setTaskCountByBoardId] = useState<Record<string, number>>({});
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const didInit = useRef(false);

  // ---------------------------------------------------------------------------
  // Enforcement — recomputed whenever boards or task counts change
  // ---------------------------------------------------------------------------

  function hasViolations(ws: Workspace, boardList: Board[], counts: Record<string, number>, programList: typeof programs): boolean {
    const limits = PLAN_LIMITS[ws.plan];
    if (boardList.length > limits.maxBoards) return true;
    for (const board of boardList) {
      if ((counts[board.id] ?? 0) > limits.maxTasksPerBoard) return true;
    }
    if (limits.maxPrograms !== Infinity && programList.length > limits.maxPrograms) return true;
    return false;
  }

  const showEnforcement =
    workspace !== null &&
    hasViolations(workspace, boards, taskCountByBoardId, programs) &&
    (phase === 'boards' || phase === 'ready' || phase === 'program');

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    initApp().catch((err) => {
      console.error('[BoardView] Init error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Unexpected error during initialisation.');
      setPhase('error');
    });
  }, []);

  async function initApp() {
    setPhase('init');

    // 1. Resolve monday workspace context
    const { getMondayContext } = await import('@/lib/monday-context');
    const ctx = await getMondayContext();

    // 2. Bootstrap workspace (upserts on first visit)
    const wsRes = await fetch(`/api/workspaces?workspace_id=${encodeURIComponent(ctx.workspaceId)}`);
    if (!wsRes.ok) {
      const err = await wsRes.json().catch(() => ({ error: wsRes.statusText }));
      throw new Error(`Failed to load workspace: ${err.error ?? wsRes.statusText}`);
    }
    const { workspace: ws }: { workspace: Workspace } = await wsRes.json();
    setWorkspace(ws);

    // 3. Load boards
    const boardsRes = await fetch(`/api/boards?workspace_id=${encodeURIComponent(ctx.workspaceId)}`);
    if (!boardsRes.ok) {
      const err = await boardsRes.json().catch(() => ({ error: boardsRes.statusText }));
      throw new Error(`Failed to load boards: ${err.error ?? boardsRes.statusText}`);
    }
    const { boards: loadedBoards }: { boards: Board[] } = await boardsRes.json();
    setBoards(loadedBoards);

    // 4. Fetch task counts for all boards (for enforcement check)
    const countsRes = await fetch(`/api/tasks/counts?workspace_id=${encodeURIComponent(ctx.workspaceId)}`);
    if (countsRes.ok) {
      const { counts } = await countsRes.json();
      setTaskCountByBoardId(counts ?? {});
    }

    // 4b. Load programs
    const programsRes = await fetch(`/api/programs?workspace_id=${encodeURIComponent(ctx.workspaceId)}`);
    if (programsRes.ok) {
      const { programs: loadedPrograms } = await programsRes.json();
      setPrograms(loadedPrograms ?? []);
    }

    // 5. Auto-select if only one board, otherwise show selector
    if (loadedBoards.length === 1) {
      await loadBoard(loadedBoards[0]);
    } else {
      setPhase('boards');
    }
  }

  async function loadBoard(board: Board) {
    setSelectedBoard(board);
    setPhase('loading');

    const tasksRes = await fetch(`/api/tasks?board_id=${encodeURIComponent(board.id)}`);
    if (!tasksRes.ok) {
      const err = await tasksRes.json().catch(() => ({ error: tasksRes.statusText }));
      throw new Error(`Failed to load tasks: ${err.error ?? tasksRes.statusText}`);
    }
    const { tasks: loadedTasks }: { tasks: Task[] } = await tasksRes.json();
    setTasks(loadedTasks);
    // Keep task count in sync
    setTaskCountByBoardId((prev) => ({ ...prev, [board.id]: loadedTasks.length }));
    setPhase('ready');
  }

  async function handleBoardCreated(board: Board) {
    setBoards((prev) => [...prev, board]);
    await loadBoard(board);
  }

  function handleSelectBoard(board: Board) {
    loadBoard(board).catch((err) => {
      console.error('[BoardView] Failed to load board:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load board.');
      setPhase('error');
    });
  }

  function handleBackToBoards() {
    setSelectedBoard(null);
    setSelectedProgram(null);
    setTasks([]);
    setPhase('boards');
  }

  function handleSelectProgram(program: Program) {
    setSelectedProgram(program);
    setPhase('program');
  }

  async function handleProgramCreated(name: string) {
    if (!workspace) return;
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspace.id, name }),
    });
    if (res.ok) {
      const { program } = await res.json();
      setPrograms((prev) => [...prev, program]);
      handleSelectProgram(program);
    }
  }

  function handleEnforcementBoardDeleted(boardId: string) {
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    setTaskCountByBoardId((prev) => {
      const next = { ...prev };
      delete next[boardId];
      return next;
    });
    // If the deleted board was selected, go back to board list
    if (selectedBoard?.id === boardId) {
      setSelectedBoard(null);
      setTasks([]);
      setPhase('boards');
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (phase === 'init' || phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <LoadingOne />
        <p className="text-xs text-monday-dark-secondary">
          {phase === 'init' ? 'Connecting…' : 'Loading tasks…'}
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="p-5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive max-w-sm w-full mx-4">
          <p className="font-semibold text-sm mb-1">Something went wrong</p>
          <p className="text-sm">{errorMessage}</p>
          <button
            onClick={() => {
              didInit.current = false;
              setPhase('init');
              setErrorMessage(null);
              initApp().catch((err) => {
                setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
                setPhase('error');
              });
            }}
            className="mt-3 px-3 py-1.5 text-sm font-medium text-white bg-monday-blue rounded hover:bg-monday-blue-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Enforcement modal — rendered on top of whatever phase is active */}
      {showEnforcement && workspace && (
        <PlanEnforcementModal
          workspace={workspace}
          boards={boards}
          programs={programs}
          taskCountByBoardId={taskCountByBoardId}
          onBoardDeleted={handleEnforcementBoardDeleted}
          onProgramDeleted={(id) => setPrograms((prev) => prev.filter((p) => p.id !== id))}
          onResolvedGoToBoard={(board) => {
            handleSelectBoard(board);
          }}
        />
      )}

      {phase === 'boards' && workspace && (
        <BoardSelector
          workspace={workspace}
          boards={boards}
          programs={programs}
          onSelectBoard={handleSelectBoard}
          onBoardCreated={handleBoardCreated}
          onBoardRenamed={(updated) => setBoards((prev) => prev.map((b) => b.id === updated.id ? updated : b))}
          onBoardDeleted={(id) => setBoards((prev) => prev.filter((b) => b.id !== id))}
          onSelectProgram={handleSelectProgram}
          onProgramCreated={handleProgramCreated}
          onProgramDeleted={(id) => setPrograms((prev) => prev.filter((p) => p.id !== id))}
        />
      )}

      {phase === 'program' && selectedProgram && workspace && (
        <main className="min-h-screen font-sans text-monday-dark">
          <div className="p-4">
            <ProgramView
              program={selectedProgram}
              boards={boards}
              workspace={workspace}
              onBack={handleBackToBoards}
              onProgramRenamed={(updated) => {
                setPrograms((prev) => prev.map((p) => p.id === updated.id ? updated : p));
                setSelectedProgram(updated);
              }}
              onProgramDeleted={(id) => {
                setPrograms((prev) => prev.filter((p) => p.id !== id));
                handleBackToBoards();
              }}
            />
          </div>
        </main>
      )}

      {phase === 'ready' && selectedBoard && workspace && (
        <main className="min-h-screen font-sans text-monday-dark">
          <ErrorBoundary>
            <div className="p-4">
              <Tree
                initialTasks={tasks}
                board={selectedBoard}
                workspace={workspace}
                onBack={handleBackToBoards}
                onBoardRenamed={(updated) => setBoards((prev) => prev.map((b) => b.id === updated.id ? updated : b))}
                onBoardDeleted={(id) => { setBoards((prev) => prev.filter((b) => b.id !== id)); handleBackToBoards(); }}
                onTaskCountChanged={(boardId, count) => setTaskCountByBoardId((prev) => ({ ...prev, [boardId]: count }))}
              />
            </div>
          </ErrorBoundary>
        </main>
      )}
    </>
  );
}
