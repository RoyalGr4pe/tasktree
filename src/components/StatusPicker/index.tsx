'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Status } from './constants';
import { StatusPickerContent } from './StatusPickerContent';

interface StatusPickerProps {
  taskId: string;
  current: Status | null;
  anchorEl: HTMLElement | null;
  onSelect: (taskId: string, status: Status | null) => void;
  onClose: () => void;
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
      className="bg-surface-overlay border border-border-input rounded-xl shadow-xl overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <StatusPickerContent taskId={taskId} current={current} onSelect={onSelect} onClose={onClose} />
    </div>,
    document.body
  );
}

export { StatusPickerContent } from './StatusPickerContent';
export { StatusDot } from './StatusDot';
export { STATUSES, STATUS_ORDER, type Status } from './constants';
