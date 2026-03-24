'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: 'backlog',     label: 'Backlog',      color: '#9ba0aa' },
  { value: 'todo',        label: 'To Do',        color: '#6366f1' },
  { value: 'in_progress', label: 'In Progress',  color: '#f0c446' },
  { value: 'in_review',   label: 'In Review',    color: '#f97316' },
  { value: 'done',        label: 'Done',         color: '#22c55e' },
];

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
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f7f8f9] transition-colors rounded-lg"
          >
            <StatusDot color={color} />
            <span className="flex-1 text-sm text-monday-dark text-left">{label}</span>
            {current === value && (
              <svg className="w-4 h-4 text-[#9ba0aa] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface StatusPickerProps extends ContentProps {
  anchorEl: HTMLElement | null;
}

export default function StatusPicker({ taskId, current, anchorEl, onSelect, onClose }: StatusPickerProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pickerWidth = 180;
    setPos({
      top: rect.bottom + window.scrollY + 6,
      left: Math.max(8, rect.right + window.scrollX - pickerWidth),
    });
  }, [anchorEl]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorEl && !anchorEl.contains(e.target as Node)
      ) { onClose(); }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorEl]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: 180 }}
      className="bg-white border border-[#e0e0e0] rounded-xl shadow-xl overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <StatusPickerContent taskId={taskId} current={current} onSelect={onSelect} onClose={onClose} />
    </div>,
    document.body
  );
}

export function StatusDot({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="6" fill={color} opacity="0.2" />
      <circle cx="7" cy="7" r="3.5" fill={color} />
    </svg>
  );
}
