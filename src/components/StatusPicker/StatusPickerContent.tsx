'use client';

import { STATUSES, type Status } from './constants';
import { StatusDot } from './StatusDot';

interface ContentProps {
  taskId: string;
  current: Status | null;
  onSelect: (taskId: string, status: Status | null) => void;
  onClose: () => void;
}

export function StatusPickerContent({ taskId, current, onSelect, onClose }: ContentProps) {
  return (
    <ul className="p-1">
      {STATUSES.map(({ value, label, color }) => (
        <li key={value}>
          <button
            onClick={() => { onSelect(taskId, value); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-node-hover transition-colors rounded-lg"
          >
            <StatusDot color={color} />
            <span className="flex-1 text-sm text-monday-dark text-left">{label}</span>
            {current === value && (
              <svg className="w-4 h-4 text-icon-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
