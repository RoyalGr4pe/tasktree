'use client';

import type { Task, Board } from '@/types';
import { isOverdue } from './utils';

interface SummaryStripProps {
  allTasks: Task[];
  assigneeMap: Record<string, string[]>;
  memberBoards: Board[];
}

export function SummaryStrip({ allTasks, assigneeMap, memberBoards }: SummaryStripProps) {
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
