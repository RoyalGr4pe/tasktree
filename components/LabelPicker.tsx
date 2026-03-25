'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Plan } from '@/types';

export interface Label {
    id: string;
    name: string;
    color: string;
    workspace_id: string;
}

interface LabelPickerContentProps {
    taskId: string;
    plan: Plan;
    assignedLabelIds: string[];
    labels: Label[];
    onLabelsChange: (taskId: string, labelIds: string[]) => void;
    onCreateLabel: (name: string, color: string) => Promise<Label>;
    onClose: () => void;
}

interface LabelPickerProps extends LabelPickerContentProps {
    anchorEl: HTMLElement | null;
}

const PRESET_COLORS = [
    '#e03e3e', '#f07046', '#f0c446', '#22c55e',
    '#6366f1', '#3b82f6', '#ec4899', '#9ba0aa',
];

export function LabelPickerContent({
    taskId,
    plan,
    assignedLabelIds,
    labels,
    onLabelsChange,
    onCreateLabel,
    onClose,
}: LabelPickerContentProps) {
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const canAddMultiple = plan !== 'free';

    useEffect(() => {
        if (creating) setTimeout(() => inputRef.current?.focus(), 0);
    }, [creating]);

    function toggleLabel(labelId: string) {
        const isActive = assignedLabelIds.includes(labelId);
        const validAssignedCount = assignedLabelIds.filter((id) => labels.some((l) => l.id === id)).length;
        if (!isActive && validAssignedCount >= 1 && !canAddMultiple) return; // free plan: max 1
        const next = isActive
            ? assignedLabelIds.filter((id) => id !== labelId)
            : [...assignedLabelIds, labelId];
        onLabelsChange(taskId, next);
    }

    async function handleCreate() {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const label = await onCreateLabel(newName.trim(), newColor);
            // Auto-assign the new label if allowed
            if (assignedLabelIds.length === 0 || canAddMultiple) {
                onLabelsChange(taskId, [...assignedLabelIds, label.id]);
            }
            setNewName('');
            setNewColor(PRESET_COLORS[0]);
            setCreating(false);
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <ul className="p-1 max-h-48 overflow-y-auto">
                {labels.length === 0 && !creating && (
                    <li className="px-3 py-2 text-xs text-icon-muted">No labels yet</li>
                )}
                {labels.map((label) => {
                    const active = assignedLabelIds.includes(label.id);
                    const validAssignedCount = assignedLabelIds.filter((id) => labels.some((l) => l.id === id)).length;
                    const disabled = !active && validAssignedCount >= 1 && !canAddMultiple;
                    return (
                        <li key={label.id}>
                            <button
                                onClick={() => toggleLabel(label.id)}
                                disabled={disabled}
                                title={disabled ? 'Upgrade to add multiple labels' : undefined}
                                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-node-hover'}`}
                            >
                                <LabelDot color={label.color} />
                                <span className="flex-1 text-sm text-monday-dark text-left">{label.name}</span>
                                {active && (
                                    <svg className="w-4 h-4 text-icon-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="border-t border-border-subtle">
                {creating ? (
                    <div className="p-2 flex flex-col gap-2">
                        <input
                            ref={inputRef}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreate();
                                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                            }}
                            placeholder="Label name"
                            className="w-full text-sm px-2 py-1 border border-border-input rounded-lg outline-none focus:border-icon-muted bg-transparent"
                        />
                        <div className="flex gap-1 flex-wrap">
                            {PRESET_COLORS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setNewColor(c)}
                                    style={{ background: c }}
                                    className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'ring-2 ring-offset-1 ring-foreground/50 scale-110' : ''}`}
                                />
                            ))}
                        </div>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => { setCreating(false); setNewName(''); }}
                                className="flex-1 text-xs border border-border-input rounded-lg py-1 hover:bg-node-hover transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newName.trim() || saving}
                                className="flex-1 text-xs bg-monday-blue text-white rounded-lg py-1 disabled:opacity-50 hover:opacity-90 transition-opacity"
                            >
                                {saving ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setCreating(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-icon-muted hover:bg-node-hover hover:text-monday-dark transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create label
                    </button>
                )}
            </div>
        </>
    );
}

export default function LabelPicker({
    anchorEl,
    ...contentProps
}: LabelPickerProps) {
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

export function LabelDot({ color }: { color: string }) {
    return (
        <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: color }}
        />
    );
}

export function LabelChip({ label, onClick }: { label: Label; onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-2 text-sm border-[0.5px] border-table-secondary font-medium px-3 py-0.5 rounded-full transition-opacity hover:opacity-80"
            style={{ color: label.color }}
        >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: label.color }} />
            {label.name}
        </button>
    );
}
