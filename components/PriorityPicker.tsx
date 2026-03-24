'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type Priority = 'no_priority' | 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'no_priority', label: 'No priority',  color: '#c8cad0' },
  { value: 'low',         label: 'Low',          color: '#a3afc4' },
  { value: 'medium',      label: 'Medium',       color: '#f0c446' },
  { value: 'high',        label: 'High',         color: '#f07046' },
  { value: 'urgent',      label: 'Urgent',       color: '#e03e3e' },
];

interface ContentProps {
  taskId: string;
  current: Priority;
  onSelect: (taskId: string, priority: Priority) => void;
  onClose: () => void;
}

// Exported so it can be embedded inline (e.g. inside a context menu submenu)
export function PriorityPickerContent({ taskId, current, onSelect, onClose }: ContentProps) {
  return (
    <>
      <ul className="p-1">
        {PRIORITIES.map(({ value, label, color }) => (
          <li key={value}>
            <button
              onClick={() => { onSelect(taskId, value); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f7f8f9] transition-colors rounded-lg"
            >
              <PriorityDot color={color} />
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
    </>
  );
}

interface PriorityPickerProps extends ContentProps {
  anchorEl: HTMLElement | null;
}

export default function PriorityPicker({ taskId, current, anchorEl, onSelect, onClose }: PriorityPickerProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pickerWidth = 200;
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
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: 200 }}
      className="bg-white border border-[#e0e0e0] rounded-xl shadow-xl overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <PriorityPickerContent taskId={taskId} current={current} onSelect={onSelect} onClose={onClose} />
    </div>,
    document.body
  );
}

export function PriorityDot({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="3" stroke={color} strokeWidth="2" fill="none" />
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill={color} />
    </svg>
  );
}
