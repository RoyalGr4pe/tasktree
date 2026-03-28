'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MondayUser } from '@/types';
import { AssigneePickerContent } from './AssigneePickerContent';

interface AssigneePickerProps {
  taskId: string;
  workspaceId: string;
  assignedUserIds: string[];
  users: MondayUser[];
  plan: 'free' | 'pro' | 'business';
  onAssigneesChange: (taskId: string, userIds: string[]) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

export default function AssigneePicker({ anchorEl, onClose, ...rest }: AssigneePickerProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pickerWidth = 260;
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
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: 260 }}
      className="bg-white border border-[#e0e0e0] rounded-xl shadow-xl overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AssigneePickerContent {...rest} onClose={onClose} />
    </div>,
    document.body
  );
}

export { AssigneePickerContent } from './AssigneePickerContent';
