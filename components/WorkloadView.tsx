'use client';

import { useMemo, useState } from 'react';
import type { Task, MondayUser } from '@/types';

interface WorkloadViewProps {
  tasks: Task[];
  assigneeMap: Record<string, string[]>;
  mondayUsers: MondayUser[];
}

type WeekBucket = 'all' | 'this_week' | 'next_week';

const WEEKLY_CAPACITY = 40; // hours — standard capacity threshold

function getWeekRange(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function formatWeekLabel(offset: number) {
  const { start, end } = getWeekRange(offset);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

// Avatar initials helper
function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Deterministic hue from user id
function avatarHue(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return Math.abs(hash) % 360;
}

export default function WorkloadView({ tasks, assigneeMap, mondayUsers }: WorkloadViewProps) {
  const [bucket, setBucket] = useState<WeekBucket>('all');

  const userMap = useMemo(() => new Map(mondayUsers.map((u) => [u.id, u])), [mondayUsers]);

  // Filter tasks by selected week bucket
  const filteredTasks = useMemo(() => {
    if (bucket === 'all') return tasks;
    const offset = bucket === 'this_week' ? 0 : 1;
    const { start, end } = getWeekRange(offset);
    return tasks.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= start && d <= end;
    });
  }, [tasks, bucket]);

  // Build a set of task IDs that have children — their estimate is a rollup, don't count directly
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of tasks) {
      if (task.parent_task_id) ids.add(task.parent_task_id);
    }
    return ids;
  }, [tasks]);

  // Compute per-user workload
  const userWorkloads = useMemo(() => {
    const hours = new Map<string, number>();
    const taskCount = new Map<string, number>();

    for (const task of filteredTasks) {
      // Skip parent tasks — their estimate is covered by their children
      if (parentIds.has(task.id)) continue;
      const assignees = assigneeMap[task.id] ?? [];
      const estimate = task.estimate_hours ?? 0;
      for (const uid of assignees) {
        hours.set(uid, (hours.get(uid) ?? 0) + estimate);
        taskCount.set(uid, (taskCount.get(uid) ?? 0) + 1);
      }
    }

    // Collect all assigned user IDs (leaf tasks only)
    const allAssignedIds = new Set<string>();
    for (const task of filteredTasks) {
      if (parentIds.has(task.id)) continue;
      for (const uid of assigneeMap[task.id] ?? []) allAssignedIds.add(uid);
    }

    return [...allAssignedIds]
      .map((uid) => ({
        userId: uid,
        user: userMap.get(uid),
        hours: hours.get(uid) ?? 0,
        taskCount: taskCount.get(uid) ?? 0,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredTasks, assigneeMap, userMap]);

  const maxHours = Math.max(...userWorkloads.map((w) => w.hours), WEEKLY_CAPACITY);

  const leafTasks = useMemo(() => filteredTasks.filter((t) => !parentIds.has(t.id)), [filteredTasks, parentIds]);

  const unassignedCount = useMemo(() => {
    return leafTasks.filter((t) => (assigneeMap[t.id] ?? []).length === 0).length;
  }, [leafTasks, assigneeMap]);

  const totalHours = useMemo(
    () => leafTasks.reduce((sum, t) => sum + (t.estimate_hours ?? 0), 0),
    [leafTasks]
  );

  return (
    <div className="px-4 pb-8 pt-2">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-monday-dark">Resource Load</h2>
          <p className="text-xs text-icon-muted mt-0.5">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} · {totalHours}h total estimated
          </p>
        </div>

        {/* Week bucket toggle */}
        <div className="flex items-center rounded-lg bg-badge-bg p-0.5 gap-0.5">
          {(['all', 'this_week', 'next_week'] as WeekBucket[]).map((b) => (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={`px-2.5 h-6 text-xs font-medium rounded-md transition-colors ${
                bucket === b
                  ? 'bg-surface text-monday-dark shadow-sm'
                  : 'text-icon-muted hover:text-monday-dark'
              }`}
            >
              {b === 'all' ? 'All time' : b === 'this_week' ? 'This week' : 'Next week'}
            </button>
          ))}
        </div>
      </div>

      {/* Week label for bucketed view */}
      {bucket !== 'all' && (
        <p className="text-xs text-icon-muted mb-4">
          {bucket === 'this_week' ? formatWeekLabel(0) : formatWeekLabel(1)}
        </p>
      )}

      {userWorkloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <svg className="w-12 h-12 text-border-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-monday-dark">No assigned tasks</p>
            <p className="text-xs text-icon-muted mt-0.5">
              {bucket !== 'all' ? 'No tasks with due dates in this period' : 'Assign tasks to team members to see workload'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {userWorkloads.map(({ userId, user, hours, taskCount }) => {
            const isOver = bucket !== 'all' && hours > WEEKLY_CAPACITY;
            const barPct = Math.min((hours / maxHours) * 100, 100);
            const capacityMarker = bucket !== 'all' ? (WEEKLY_CAPACITY / maxHours) * 100 : null;
            const hue = avatarHue(userId);
            const displayName = user?.name ?? userId;

            return (
              <div key={userId} className="bg-surface rounded-xl border border-border-subtle p-4">
                {/* User row */}
                <div className="flex items-center gap-3 mb-3">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full shrink-0 object-cover"
                      style={{ border: '2px solid var(--color-avatar-border)' }}
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: `hsl(${hue}, 55%, 52%)` }}
                    >
                      {initials(displayName)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-monday-dark truncate">{displayName}</span>
                      {isOver && (
                        <span className="flex items-center gap-1 text-xs font-medium text-monday-error shrink-0">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Over capacity
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-icon-muted">
                      {taskCount} task{taskCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <span className={`text-sm font-bold shrink-0 ${isOver ? 'text-monday-error' : 'text-monday-dark'}`}>
                    {hours % 1 === 0 ? hours : hours.toFixed(1)}h
                  </span>
                </div>

                {/* Bar */}
                <div className="relative h-2 rounded-full bg-badge-bg overflow-visible">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${barPct}%`,
                      background: isOver
                        ? 'var(--color-monday-error)'
                        : hours === 0
                        ? 'var(--color-border-subtle)'
                        : 'var(--color-monday-blue)',
                    }}
                  />
                  {/* Capacity marker line */}
                  {capacityMarker !== null && capacityMarker <= 100 && (
                    <div
                      className="absolute top-[-3px] bottom-[-3px] w-px bg-monday-dark/30"
                      style={{ left: `${capacityMarker}%` }}
                      title={`${WEEKLY_CAPACITY}h capacity`}
                    />
                  )}
                </div>

                {/* Capacity label */}
                {bucket !== 'all' && (
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-icon-muted">0h</span>
                    <span className="text-xs text-icon-muted">{WEEKLY_CAPACITY}h capacity</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned tasks summary */}
          {unassignedCount > 0 && (
            <div className="bg-surface rounded-xl border border-border-subtle p-4 opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-badge-bg">
                  <svg className="w-4 h-4 text-icon-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-monday-dark">Unassigned</span>
                  <p className="text-xs text-icon-muted">{unassignedCount} task{unassignedCount !== 1 ? 's' : ''} with no assignee</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
