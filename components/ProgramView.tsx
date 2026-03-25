'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Program, Board, Task, TaskAssignee, MondayUser, TaskRollup } from '@/types';
import { STATUSES } from '@/components/StatusPicker';
import { computeRollups } from '@/lib/tree-utils';

interface ProgramViewProps {
  program: Program;
  boards: Board[];
  workspace: { id: string };
  onBack: () => void;
  onProgramRenamed: (program: Program) => void;
  onProgramDeleted: (programId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOARD_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
];

function getBoardColorClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return BOARD_COLORS[Math.abs(hash) % BOARD_COLORS.length];
}

function getStatusColor(status: string | null): string {
  return STATUSES.find((s) => s.value === status)?.color ?? '#9ba0aa';
}

function progressBarColor(pct: number): string {
  if (pct >= 100) return 'var(--color-monday-success)';
  if (pct >= 50) return 'var(--color-monday-blue)';
  return 'var(--color-monday-warning)';
}

function todayDate(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

function isOverdue(due_date: string | null): boolean {
  if (!due_date) return false;
  const d = new Date(due_date); d.setHours(0, 0, 0, 0);
  return d < todayDate();
}

function nearestFutureDue(tasks: Task[]): string | null {
  const dates = tasks
    .filter((t) => t.due_date && !isOverdue(t.due_date) && t.status !== 'done')
    .map((t) => t.due_date!);
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type HealthStatus = 'on_track' | 'at_risk' | 'blocked' | 'complete' | 'empty';

function computeHealth(tasks: Task[], assigneeMap: Record<string, string[]>): HealthStatus {
  if (tasks.length === 0) return 'empty';
  const active = tasks.filter((t) => t.status !== 'done');
  if (active.length === 0) return 'complete';
  const overdueCount = active.filter((t) => isOverdue(t.due_date)).length;
  if (overdueCount > 0) return 'blocked';
  const unassigned = active.filter((t) => (assigneeMap[t.id] ?? []).length === 0).length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress' || t.status === 'in_review').length;
  if (inProgress === 0 && unassigned > active.length * 0.5) return 'at_risk';
  return 'on_track';
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; bg: string; text: string; dot: string }> = {
  on_track: { label: 'On Track',  dot: 'var(--color-monday-success)', bg: 'rgba(0,133,77,0.1)',    text: 'var(--color-monday-success)' },
  at_risk:  { label: 'At Risk',   dot: '#b88a00',                     bg: 'rgba(255,203,0,0.15)',  text: '#b88a00' },
  blocked:  { label: 'Overdue',   dot: 'var(--color-monday-error)',   bg: 'rgba(216,58,82,0.1)',   text: 'var(--color-monday-error)' },
  complete: { label: 'Complete',  dot: 'var(--color-monday-success)', bg: 'rgba(0,133,77,0.1)',    text: 'var(--color-monday-success)' },
  empty:    { label: 'No tasks',  dot: '#9ba0aa',                     bg: 'rgba(155,160,170,0.1)', text: '#9ba0aa' },
};

// ---------------------------------------------------------------------------
// Status breakdown bar — stacked segments per status
// ---------------------------------------------------------------------------
const STATUS_ORDER = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;

function StatusBar({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  if (total === 0) return <div className="flex-1 h-1.5 rounded-full bg-badge-bg" />;
  const segments = STATUS_ORDER.map((s) => ({
    status: s,
    color: getStatusColor(s),
    label: STATUSES.find((st) => st.value === s)?.label ?? s,
    count: tasks.filter((t) => (t.status ?? 'backlog') === s).length,
  })).filter((s) => s.count > 0);

  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px flex-1">
      {segments.map(({ status, color, label, count }) => (
        <div
          key={status}
          style={{ width: `${(count / total) * 100}%`, background: color }}
          title={`${label}: ${count}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board card
// ---------------------------------------------------------------------------
interface BoardCardProps {
  board: Board;
  tasks: Task[];
  rollupMap: Map<string, TaskRollup>;
  mondayUsers: MondayUser[];
  assigneeMap: Record<string, string[]>;
  onRemove: (boardId: string) => void;
}

function BoardCard({ board, tasks, rollupMap, mondayUsers, assigneeMap, onRemove }: BoardCardProps) {
  const [expanded, setExpanded] = useState(true);
  const colorClass = getBoardColorClass(board.id);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
  const parentIds = new Set(tasks.map((t) => t.parent_task_id).filter(Boolean));
  const totalHours = tasks.filter((t) => !parentIds.has(t.id)).reduce((sum, t) => sum + (t.estimate_hours ?? 0), 0);
  const overdueCount = tasks.filter((t) => t.status !== 'done' && isOverdue(t.due_date)).length;
  const unassignedCount = tasks.filter((t) => (assigneeMap[t.id] ?? []).length === 0 && t.status !== 'done').length;
  const nextDue = nearestFutureDue(tasks);
  const health = computeHealth(tasks, assigneeMap);
  const healthCfg = HEALTH_CONFIG[health];

  const allAssigneeIds = [...new Set(tasks.flatMap((t) => assigneeMap[t.id] ?? []))];
  const rootTasks = tasks.filter((t) => t.parent_task_id === null);

  return (
    <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
      {/* Board header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-icon-muted hover:text-monday-dark transition-colors"
        >
          <svg
            width="10" height="10" viewBox="0 0 8 8" fill="currentColor"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 120ms' }}
          >
            <path d="M2 1.5l4 2.5-4 2.5V1.5z" />
          </svg>
        </button>

        <div className={`w-7 h-7 rounded-lg ${colorClass} flex items-center justify-center shrink-0 text-white text-[10px] font-bold`}>
          {board.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-monday-dark truncate block">{board.name}</span>
        </div>

        {/* Health badge */}
        <span
          className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: healthCfg.bg, color: healthCfg.text }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: healthCfg.dot }} />
          {healthCfg.label}
        </span>

        {/* Overdue count */}
        {overdueCount > 0 && (
          <span
            className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: 'rgba(216,58,82,0.1)', color: 'var(--color-monday-error)' }}
            title={`${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''}`}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {overdueCount}
          </span>
        )}

        {/* Assignee avatars */}
        {allAssigneeIds.length > 0 && (
          <div className="flex items-center shrink-0">
            {allAssigneeIds.slice(0, 4).map((uid, i) => {
              const user = mondayUsers.find((u) => u.id === uid);
              const name = user?.name ?? uid;
              return user?.avatar ? (
                <img key={uid} src={user.avatar} alt={name} title={name}
                  className="w-5 h-5 rounded-full object-cover border-2 border-surface"
                  style={{ marginLeft: i > 0 ? -6 : 0 }} />
              ) : (
                <div key={uid} title={name}
                  className="w-5 h-5 rounded-full bg-badge-bg border-2 border-surface flex items-center justify-center text-[9px] font-bold text-icon-muted"
                  style={{ marginLeft: i > 0 ? -6 : 0 }}>
                  {name.slice(0, 2).toUpperCase()}
                </div>
              );
            })}
            {allAssigneeIds.length > 4 && (
              <div className="w-5 h-5 rounded-full bg-badge-bg border-2 border-surface flex items-center justify-center text-[9px] font-bold text-icon-muted" style={{ marginLeft: -6 }}>
                +{allAssigneeIds.length - 4}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onRemove(board.id)}
          className="shrink-0 p-1 rounded text-icon-muted hover:text-monday-error hover:bg-monday-error/10 transition-colors"
          title="Remove board from portfolio"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar + meta */}
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <StatusBar tasks={tasks} />
          <span className="text-xs font-semibold text-monday-dark tabular-nums w-8 text-right shrink-0">{progress}%</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-icon-muted flex-wrap">
          <span>{doneTasks}/{totalTasks} done</span>
          {totalHours > 0 && <span>{totalHours}h est.</span>}
          {unassignedCount > 0 && (
            <span style={{ color: '#b88a00', fontWeight: 600 }}>{unassignedCount} unassigned</span>
          )}
          {nextDue && (
            <span className="ml-auto">
              Next due <span className="font-medium text-monday-dark">{formatDate(nextDue)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Expanded task rows */}
      {expanded && totalTasks > 0 && (
        <div className="border-t border-border-subtle divide-y divide-border-subtle/50">
          {rootTasks.length === 0 ? (
            <div className="px-4 py-3 text-xs text-icon-muted italic">No root tasks</div>
          ) : (
            rootTasks.map((task) => {
              const rollup = rollupMap.get(task.id);
              const pct = rollup ? rollup.progress_percent : (task.status === 'done' ? 100 : 0);
              const statusColor = getStatusColor(task.status);
              const childCount = rollup?.child_count ?? 0;
              const taskAssignees = (assigneeMap[task.id] ?? []).slice(0, 3);
              const overdue = isOverdue(task.due_date) && task.status !== 'done';

              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2 hover:bg-node-hover transition-colors">
                  <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
                    <circle cx="5" cy="5" r="4" fill={statusColor} opacity={0.2} />
                    <circle cx="5" cy="5" r="2.5" fill={statusColor} />
                  </svg>

                  <span className="flex-1 text-sm text-monday-dark truncate">
                    {task.title || <span className="italic text-icon-muted">Untitled</span>}
                  </span>

                  {task.due_date && (
                    <span
                      className="text-xs shrink-0"
                      style={{ color: overdue ? 'var(--color-monday-error)' : 'var(--color-icon-muted)', fontWeight: overdue ? 600 : 400 }}
                    >
                      {overdue && '⚠ '}{formatDate(task.due_date)}
                    </span>
                  )}

                  {taskAssignees.length > 0 && (
                    <div className="flex items-center shrink-0">
                      {taskAssignees.map((uid, i) => {
                        const user = mondayUsers.find((u) => u.id === uid);
                        const name = user?.name ?? uid;
                        return user?.avatar ? (
                          <img key={uid} src={user.avatar} alt={name} title={name}
                            className="w-4 h-4 rounded-full object-cover border border-surface"
                            style={{ marginLeft: i > 0 ? -4 : 0 }} />
                        ) : (
                          <div key={uid} title={name}
                            className="w-4 h-4 rounded-full bg-badge-bg border border-surface flex items-center justify-center text-[8px] font-bold text-icon-muted"
                            style={{ marginLeft: i > 0 ? -4 : 0 }}>
                            {name.slice(0, 1).toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {childCount > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-icon-muted">{childCount}</span>
                      <svg width="14" height="14" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="6" fill="none" stroke="var(--color-border-subtle)" strokeWidth="2.5" />
                        <circle cx="8" cy="8" r="6" fill="none"
                          stroke={progressBarColor(pct)}
                          strokeWidth="2.5"
                          strokeDasharray={`${(pct / 100) * 37.7} 37.7`}
                          strokeLinecap="round"
                          transform="rotate(-90 8 8)"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add board picker
// ---------------------------------------------------------------------------
interface AddBoardPickerProps {
  available: Board[];
  onAdd: (board: Board) => void;
  onClose: () => void;
}

function AddBoardPicker({ available, onAdd, onClose }: AddBoardPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = available.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-surface border border-border-subtle rounded-xl shadow-xl overflow-hidden w-64">
      <div className="px-3 pt-2 pb-2 border-b border-border-subtle">
        <input
          autoFocus
          type="text"
          placeholder="Search boards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm text-monday-dark placeholder:text-monday-dark bg-transparent outline-none border-none"
        />
      </div>
      <ul className="max-h-48 overflow-y-auto p-1">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-sm text-icon-muted text-center">No boards available</li>
        )}
        {filtered.map((b) => (
          <li key={b.id}>
            <button
              onClick={() => { onAdd(b); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-node-hover transition-colors rounded-lg text-left"
            >
              <div className={`w-5 h-5 rounded ${getBoardColorClass(b.id)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                {b.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-sm text-monday-dark truncate">{b.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Program-level summary strip
// ---------------------------------------------------------------------------
interface SummaryStripProps {
  allTasks: Task[];
  assigneeMap: Record<string, string[]>;
  memberBoards: Board[];
}

function SummaryStrip({ allTasks, assigneeMap, memberBoards }: SummaryStripProps) {
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.status === 'done').length;
  const overdue = allTasks.filter((t) => t.status !== 'done' && isOverdue(t.due_date)).length;
  const unassigned = allTasks.filter((t) => (assigneeMap[t.id] ?? []).length === 0 && t.status !== 'done').length;
  const parentIds = new Set(allTasks.map((t) => t.parent_task_id).filter(Boolean));
  const totalHours = allTasks.filter((t) => !parentIds.has(t.id)).reduce((sum, t) => sum + (t.estimate_hours ?? 0), 0);
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  const stats: { label: string; value: string | number; warn: boolean }[] = [
    { label: 'Progress',    value: `${progress}%`, warn: false },
    { label: 'Boards',      value: memberBoards.length, warn: false },
    { label: 'Total tasks', value: total, warn: false },
    { label: 'Done',        value: done, warn: false },
    { label: 'Overdue',     value: overdue, warn: overdue > 0 },
    { label: 'Unassigned',  value: unassigned, warn: unassigned > 0 },
    ...(totalHours > 0 ? [{ label: 'Est. hours', value: `${totalHours}h`, warn: false }] : []),
  ];

  return (
    <div className="flex items-stretch rounded-xl overflow-hidden border border-border-subtle mb-4 divide-x divide-border-subtle">
      {stats.map(({ label, value, warn }) => (
        <div key={label} className="flex-1 flex flex-col items-center justify-center py-3 px-2 bg-surface">
          <span
            className="text-base font-bold tabular-nums"
            style={{ color: warn ? 'var(--color-monday-error)' : 'var(--color-monday-dark)' }}
          >
            {value}
          </span>
          <span className="text-[10px] text-icon-muted mt-0.5 whitespace-nowrap">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgramView
// ---------------------------------------------------------------------------
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
    fetch('/api/users')
      .then((r) => r.json())
      .then(({ users }) => setMondayUsers(users ?? []))
      .catch(() => {});
  }, []);

  const fetchBoard = useCallback(async (boardId: string) => {
    setLoadingBoards((prev) => new Set(prev).add(boardId));
    try {
      const [tasksRes, assigneesRes] = await Promise.all([
        fetch(`/api/tasks?board_id=${boardId}`),
        fetch(`/api/tasks/assignees?board_id=${boardId}`),
      ]);
      const { tasks } = await tasksRes.json();
      const { assignees } = await assigneesRes.json();
      setTasksByBoard((prev) => ({ ...prev, [boardId]: tasks ?? [] }));
      const map: Record<string, string[]> = {};
      for (const a of (assignees ?? []) as (TaskAssignee & { task_id: string })[]) {
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
    const result: Record<string, Map<string, TaskRollup>> = {};
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
    await fetch(`/api/programs/${program.id}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board_id: board.id }),
    }).catch((err) => console.error('[ProgramView] Failed to add board:', err));
    fetchBoard(board.id);
  }

  async function handleRemoveBoard(boardId: string) {
    setMemberBoardIds((prev) => prev.filter((id) => id !== boardId));
    await fetch(`/api/programs/${program.id}/boards?board_id=${boardId}`, { method: 'DELETE' })
      .catch((err) => console.error('[ProgramView] Failed to remove board:', err));
  }

  async function commitRename() {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === programName) return;
    setProgramName(trimmed);
    const res = await fetch(`/api/programs/${program.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      const { program: updated } = await res.json();
      onProgramRenamed(updated);
    } else {
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
