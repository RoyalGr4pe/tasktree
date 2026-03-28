'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Priority } from './constants';
import { PriorityPickerContent } from './PriorityPickerContent';

interface PriorityPickerProps {
  taskId: string;
  current: Priority;
  anchorEl: HTMLElement | null;
  onSelect: (taskId: string, priority: Priority) => void;
  onClose: () => void;
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
      className="bg-surface-overlay border border-border-input rounded-xl shadow-xl overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <PriorityPickerContent taskId={taskId} current={current} onSelect={onSelect} onClose={onClose} />
    </div>,
    document.body
  );
}

export { PriorityPickerContent } from './PriorityPickerContent';
export { PriorityDot } from './PriorityDot';
export { PRIORITIES, type Priority } from './constants';
