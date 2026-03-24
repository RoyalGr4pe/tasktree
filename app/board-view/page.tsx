'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import BoardSelector from '@/components/BoardSelector';
import type { Board, Task, Workspace } from '@/types';

const Tree = dynamic(() => import('@/components/Tree/Tree'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-10">
      <Spinner />
    </div>
  ),
});

type AppPhase =
  | 'init'       // resolving monday context + bootstrapping workspace
  | 'boards'     // showing board selector / empty state
  | 'loading'    // fetching tasks for selected board
  | 'ready'      // tree ready
  | 'error';

export default function BoardViewPage() {
  const [phase, setPhase] = useState<AppPhase>('init');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const didInit = useRef(false);

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

    // 4. Auto-select if only one board, otherwise show selector
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
    setTasks([]);
    setPhase('boards');
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (phase === 'init' || phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <Spinner />
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

  if (phase === 'boards' && workspace) {
    return (
      <BoardSelector
        workspace={workspace}
        boards={boards}
        onSelectBoard={handleSelectBoard}
        onBoardCreated={handleBoardCreated}
      />
    );
  }

  if (phase === 'ready' && selectedBoard && workspace) {
    return (
      <main className="min-h-screen font-sans text-monday-dark">
        <ErrorBoundary>
          <div className="p-4">
            <Tree
              initialTasks={tasks}
              board={selectedBoard}
              workspace={workspace}
              onBack={handleBackToBoards}
            />
          </div>
        </ErrorBoundary>
      </main>
    );
  }

  return null;
}
