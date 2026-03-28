'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Plan } from '@/types';
import type { Label } from './types';
import { LabelPickerContent } from './LabelPickerContent';

interface LabelPickerProps {
    taskId: string;
    plan: Plan;
    assignedLabelIds: string[];
    labels: Label[];
    onLabelsChange: (taskId: string, labelIds: string[]) => void;
    onCreateLabel: (name: string, color: string) => Promise<Label>;
    onClose: () => void;
    anchorEl: HTMLElement | null;
}

export default function LabelPicker({ anchorEl, ...contentProps }: LabelPickerProps) {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!anchorEl) return;
        const rect = anchorEl.getBoundingClientRect();
        const pickerWidth = 220;
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
            ) { contentProps.onClose(); }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [contentProps.onClose, anchorEl]);

    if (!pos) return null;

    return createPortal(
        <div
            ref={ref}
            style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: 220 }}
            className="bg-surface-overlay border border-border-input rounded-xl shadow-xl overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <LabelPickerContent {...contentProps} />
        </div>,
        document.body
    );
}

export { LabelPickerContent } from './LabelPickerContent';
export { LabelDot } from './LabelDot';
export { LabelChip } from './LabelChip';
export type { Label } from './types';
