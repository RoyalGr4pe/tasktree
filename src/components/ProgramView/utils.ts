import { STATUSES } from '@/components/StatusPicker';
import type { Task } from '@/types';

const BOARD_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
];

export function getBoardColorClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return BOARD_COLORS[Math.abs(hash) % BOARD_COLORS.length];
}

export function getStatusColor(status: string | null): string {
  return STATUSES.find((s) => s.value === status)?.color ?? '#9ba0aa';
}

export function progressBarColor(pct: number): string {
  if (pct >= 100) return 'var(--color-monday-success)';
  if (pct >= 50) return 'var(--color-monday-blue)';
  return 'var(--color-monday-warning)';
}

function todayDate(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

export function isOverdue(due_date: string | null): boolean {
  if (!due_date) return false;
  const d = new Date(due_date); d.setHours(0, 0, 0, 0);
  return d < todayDate();
}

export function nearestFutureDue(tasks: Task[]): string | null {
  const dates = tasks
    .filter((t) => t.due_date && !isOverdue(t.due_date) && t.status !== 'done')
    .map((t) => t.due_date!);
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export type HealthStatus = 'on_track' | 'at_risk' | 'blocked' | 'complete' | 'empty';

export function computeHealth(tasks: Task[], assigneeMap: Record<string, string[]>): HealthStatus {
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

export const HEALTH_CONFIG: Record<HealthStatus, { label: string; bg: string; text: string; dot: string }> = {
  on_track: { label: 'On Track',  dot: 'var(--color-monday-success)', bg: 'rgba(0,133,77,0.1)',    text: 'var(--color-monday-success)' },
  at_risk:  { label: 'At Risk',   dot: '#b88a00',                     bg: 'rgba(255,203,0,0.15)',  text: '#b88a00' },
  blocked:  { label: 'Overdue',   dot: 'var(--color-monday-error)',   bg: 'rgba(216,58,82,0.1)',   text: 'var(--color-monday-error)' },
  complete: { label: 'Complete',  dot: 'var(--color-monday-success)', bg: 'rgba(0,133,77,0.1)',    text: 'var(--color-monday-success)' },
  empty:    { label: 'No tasks',  dot: '#9ba0aa',                     bg: 'rgba(155,160,170,0.1)', text: '#9ba0aa' },
};
