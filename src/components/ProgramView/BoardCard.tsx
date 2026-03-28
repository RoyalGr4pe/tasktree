'use client';

import { useState } from 'react';
import type { Board, Task, MondayUser, TaskRollup } from '@/types';
import {
  getBoardColorClass, getStatusColor, progressBarColor,
  isOverdue, nearestFutureDue, formatDate, computeHealth, HEALTH_CONFIG,
} from './utils';
import { StatusBar } from './StatusBar';

interface BoardCardProps {
  board: Board;
  tasks: Task[];
  rollupMap: Map<string, TaskRollup>;
  mondayUsers: MondayUser[];
  assigneeMap: Record<string, string[]>;
  onRemove: (boardId: string) => void;
}

export function BoardCard({ board, tasks, rollupMap, mondayUsers, assigneeMap, onRemove }: BoardCardProps) {
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

        <span
          className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: healthCfg.bg, color: healthCfg.text }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: healthCfg.dot }} />
          {healthCfg.label}
        </span>

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
