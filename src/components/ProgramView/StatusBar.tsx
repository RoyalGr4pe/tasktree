'use client';

import type { Task } from '@/types';
import { STATUSES, STATUS_ORDER } from '@/components/StatusPicker';
import { getStatusColor } from './utils';

export function StatusBar({ tasks }: { tasks: Task[] }) {
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
