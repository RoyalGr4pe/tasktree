'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { TreeTask, MondayUser, Plan, TaskRollup, DependencyMap } from '@/types';
import { TREE_CONFIG } from '@/config/tree';
import AssigneeAvatars from '@/components/AssigneeAvatars';
import AssigneePicker from '@/components/AssigneePicker';
import PriorityPicker from '@/components/PriorityPicker';
import StatusPicker, { StatusDot, STATUSES } from '@/components/StatusPicker';
import type { Status } from '@/components/StatusPicker';
import { DueDatePicker, formatDueDate, isDueDateOverdue } from '@/components/DueDatePicker';
import { HiCalendar } from 'react-icons/hi2';
import LabelPicker, { LabelChip } from '@/components/LabelPicker';
import type { Label } from '@/components/LabelPicker';
import RollupBadges from '@/components/RollupBadges';
import type { Priority } from '@/components/PriorityPicker';
import { PRIORITIES } from '@/components/PriorityPicker';
import { PriorityIcon } from './icons';

export interface NodeRowHandle {
    startEditing: () => void;
}

export interface NodeRowProps {
    node: TreeTask;
    onToggle: (nodeId: string) => void;
    onRename: (taskId: string, newTitle: string) => Promise<void>;
    editingNodeId?: string | null;
    onEditingDone?: () => void;
    selectedIds: Set<string>;
    onSelect: (nodeId: string, checked: boolean) => void;
    assigneeMap: Record<string, string[]>;
    mondayUsers: MondayUser[];
    workspaceId: string;
    plan: Plan;
    pickerOpenForId: string | null;
    onPickerOpen: (taskId: string) => void;
    onPickerClose: () => void;
    onAssigneesChange: (taskId: string, userIds: string[]) => void;
    priorityPickerOpenForId: string | null;
    onPriorityPickerOpen: (taskId: string) => void;
    onPriorityPickerClose: () => void;
    onPriorityChange: (taskId: string, priority: Priority) => void;
    statusPickerOpenForId: string | null;
    onStatusPickerOpen: (taskId: string) => void;
    onStatusPickerClose: () => void;
    onStatusChange: (taskId: string, status: Status | null) => void;
    onDueDateChange: (taskId: string, date: string | null) => void;
    labels: Label[];
    labelMap: Record<string, string[]>;
    labelPickerOpenForId: string | null;
    onLabelPickerOpen: (taskId: string) => void;
    onLabelPickerClose: () => void;
    onLabelsChange: (taskId: string, labelIds: string[]) => void;
    onCreateLabel: (name: string, color: string) => Promise<Label>;
    rollupMap: Map<string, TaskRollup>;
    onEstimateChange: (taskId: string, hours: number | null) => void;
    dependencyMap: DependencyMap;
    blockedIds: Set<string>;
    dragHandleProps: Record<string, unknown>;
    isDropTarget: boolean;
}

const NodeRow = forwardRef<NodeRowHandle, NodeRowProps>(function NodeRow({
    node,
    onToggle,
    onRename,
    editingNodeId,
    onEditingDone,
    selectedIds,
    onSelect,
    assigneeMap,
    mondayUsers,
    workspaceId,
    plan,
    pickerOpenForId,
    onPickerOpen,
    onPickerClose,
    onAssigneesChange,
    priorityPickerOpenForId,
    onPriorityPickerOpen,
    onPriorityPickerClose,
    onPriorityChange,
    statusPickerOpenForId,
    onStatusPickerOpen,
    onStatusPickerClose,
    onStatusChange,
    onDueDateChange,
    labels,
    labelMap,
    labelPickerOpenForId,
    onLabelPickerOpen,
    onLabelPickerClose,
    onLabelsChange,
    onCreateLabel,
    rollupMap,
    onEstimateChange,
    dependencyMap,
    blockedIds,
    dragHandleProps,
    isDropTarget,
}, ref) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(node.title ?? '');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const justFocusedRef = useRef(false);

    const [isEditingEstimate, setIsEditingEstimate] = useState(false);
    const [estimateValue, setEstimateValue] = useState(String(node.estimate_hours ?? ''));

    const nodeRollup = rollupMap.get(node.id);
    const nodeHasChildren = nodeRollup ? nodeRollup.child_count > 0 : false;
    const displayedEstimate = nodeHasChildren
        ? (nodeRollup!.total_estimated_hours > 0 ? nodeRollup!.total_estimated_hours : null)
        : (node.estimate_hours ?? null);
    const estimateInputRef = useRef<HTMLInputElement>(null);

    const commitEstimate = useCallback(() => {
        setIsEditingEstimate(false);
        const raw = estimateValue.trim();
        const parsed = raw === '' ? null : parseFloat(raw);
        const current = node.estimate_hours ?? null;
        if (parsed === current || (parsed !== null && isNaN(parsed))) {
            setEstimateValue(String(node.estimate_hours ?? ''));
            return;
        }
        onEstimateChange(node.id, parsed);
    }, [estimateValue, node.estimate_hours, node.id, onEstimateChange]);

    useEffect(() => {
        if (editingNodeId === node.id) {
            setEditValue(node.title ?? '');
            setIsEditing(true);
            justFocusedRef.current = true;
            setTimeout(() => {
                inputRef.current?.select();
                setTimeout(() => { justFocusedRef.current = false; }, 200);
            }, 0);
        }
    }, [editingNodeId, node.id, node.title]);

    const startEditing = useCallback(() => {
        if (isSaving) return;
        setEditValue(node.title ?? '');
        setIsEditing(true);
        justFocusedRef.current = true;
        setTimeout(() => {
            inputRef.current?.select();
            setTimeout(() => { justFocusedRef.current = false; }, 200);
        }, 0);
    }, [node.title, isSaving]);

    useImperativeHandle(ref, () => ({ startEditing }), [startEditing]);

    const commitRename = useCallback(async () => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === node.title) {
            setIsEditing(false);
            setEditValue(node.title ?? '');
            onEditingDone?.();
            return;
        }
        setIsSaving(true);
        try {
            await onRename(node.id, trimmed);
        } finally {
            setIsSaving(false);
            setIsEditing(false);
            onEditingDone?.();
        }
    }, [editValue, node.title, node.id, onRename, onEditingDone]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
            else if (e.key === 'Escape') {
                setIsEditing(false);
                setEditValue(node.title ?? '');
                onEditingDone?.();
            }
        },
        [commitRename, node.title, onEditingDone]
    );

    const avatarButtonRef = useRef<HTMLButtonElement>(null);
    const labelButtonRef = useRef<HTMLElement>(null);
    const priorityButtonRef = useRef<HTMLButtonElement>(null);
    const statusButtonRef = useRef<HTMLButtonElement>(null);

    const isTemp = node.id.startsWith('__temp__');
    const hasChildren = node.children.length > 0;
    const isBlocked = blockedIds.has(node.id);
    const isExpanded = node.isExpanded !== false;
    const dueDateLabel = formatDueDate(node.due_date ?? null);
    const isOverdue = isDueDateOverdue(node.due_date ?? null);
    const isSoon = ['Today', 'Tomorrow'].includes(dueDateLabel);

    return (
        <div
            className={[
                `group relative flex items-center ${TREE_CONFIG.rowHeight} text-table-foreground rounded-lg transition-colors duration-75 cursor-default select-none`,
                isDropTarget ? 'bg-blue-50' : selectedIds.has(node.id) ? 'bg-node-selected' : 'hover:bg-node-hover',
            ].join(' ')}
        >
            {/* Indent for depth */}
            <div style={{ width: node.depth * TREE_CONFIG.indentPx + 4 }} className="shrink-0" />

            {/* Drag handle */}
            <div
                {...dragHandleProps}
                className="shrink-0 w-5 flex items-center justify-center text-icon-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            >
                <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                    <circle cx="3" cy="2.5" r="1.2" />
                    <circle cx="7" cy="2.5" r="1.2" />
                    <circle cx="3" cy="7" r="1.2" />
                    <circle cx="7" cy="7" r="1.2" />
                    <circle cx="3" cy="11.5" r="1.2" />
                    <circle cx="7" cy="11.5" r="1.2" />
                </svg>
            </div>

            {/* Checkbox */}
            <div className={`shrink-0 w-6 flex items-center justify-center ${selectedIds.has(node.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                <Checkbox
                    checked={selectedIds.has(node.id)}
                    onCheckedChange={(checked) => onSelect(node.id, !!checked)}
                    className={`${TREE_CONFIG.checkboxSize} rounded-[3px] border-icon-muted hover:border-table-foreground data-[state=checked]:bg-monday-blue data-[state=checked]:border-monday-blue`}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {/* Expand caret */}
            <button
                onClick={() => hasChildren && onToggle(node.id)}
                tabIndex={-1}
                className={[
                    `shrink-0 ${TREE_CONFIG.caretButtonSize} flex items-center justify-center rounded transition-colors`,
                    hasChildren ? 'hover:bg-badge-bg' : 'opacity-0 pointer-events-none',
                ].join(' ')}
            >
                <svg
                    width={TREE_CONFIG.caretSvgSize} height={TREE_CONFIG.caretSvgSize} viewBox="0 0 8 8" fill="currentColor"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 120ms ease' }}
                >
                    <path d="M2 1.5l4 2.5-4 2.5V1.5z" />
                </svg>
            </button>

            {/* Status icon */}
            <div className="shrink-0 ml-1">
                <button
                    ref={statusButtonRef}
                    onClick={() => statusPickerOpenForId === node.id ? onStatusPickerClose() : onStatusPickerOpen(node.id)}
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-badge-bg transition-colors"
                    title={STATUSES.find((s) => s.value === node.status)?.label ?? 'No status'}
                >
                    <StatusDot color={STATUSES.find((s) => s.value === node.status)?.color ?? '#e0e0e0'} />
                </button>
                {statusPickerOpenForId === node.id && (
                    <StatusPicker
                        taskId={node.id}
                        current={node.status as Status | null}
                        anchorEl={statusButtonRef.current}
                        onSelect={onStatusChange}
                        onClose={onStatusPickerClose}
                    />
                )}
            </div>

            {/* Blocked indicator */}
            {isBlocked && (
                <div
                    className="shrink-0 ml-1 flex items-center justify-center w-5 h-5 rounded text-monday-error"
                    title={`Blocked — waiting on ${(dependencyMap[node.id] ?? []).length} unfinished task(s)`}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 11V8A6 6 0 006 8v3H4v11h16V11h-2zm-8-3a4 4 0 018 0v3H10V8zm2 8.7V18h-2v-1.3a2 2 0 112 0z" />
                    </svg>
                </div>
            )}

            {/* Name */}
            <div className="flex-1 min-w-0 mx-2 flex items-center">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => { if (!justFocusedRef.current) commitRename(); }}
                        onKeyDown={handleKeyDown}
                        disabled={isSaving}
                        className={`min-w-lg max-w-2xl ${TREE_CONFIG.fontSize} text-monday-dark font-semibold bg-transparent outline-none border-none disabled:opacity-50`}
                        autoFocus
                    />
                ) : (
                    <span
                        className={`block truncate font-semibold ${TREE_CONFIG.fontSize} text-monday-dark leading-tight`}
                        title={node.title}
                        onDoubleClick={startEditing}
                    >
                        {node.title || <span className="italic text-table-secondary">Untitled</span>}
                    </span>
                )}
            </div>

            {/* Collapsed child count badge */}
            {hasChildren && !isExpanded && (
                <span className={`shrink-0 ${TREE_CONFIG.badgeFontSize} font-medium bg-badge-bg rounded-full px-1.5 py-0.5 leading-none`}>
                    {node.children.length}
                </span>
            )}

            {/* Rollup circle */}
            {hasChildren && rollupMap.has(node.id) && (
                <div className="shrink-0 mr-2">
                    <RollupBadges rollup={rollupMap.get(node.id)!} />
                </div>
            )}

            {/* Labels */}
            {(labelMap[node.id] ?? []).length > 0 && (
                <div className="shrink-0 flex items-center gap-1 mx-2">
                    <span ref={labelButtonRef} />
                    {(labelMap[node.id] ?? []).map((id) => {
                        const label = labels.find((l) => l.id === id);
                        return label ? (
                            <LabelChip
                                key={id}
                                label={label}
                                onClick={() => labelPickerOpenForId === node.id ? onLabelPickerClose() : onLabelPickerOpen(node.id)}
                            />
                        ) : null;
                    })}
                    {labelPickerOpenForId === node.id && (
                        <LabelPicker
                            taskId={node.id}
                            plan={plan}
                            assignedLabelIds={labelMap[node.id] ?? []}
                            labels={labels}
                            anchorEl={labelButtonRef.current}
                            onLabelsChange={onLabelsChange}
                            onCreateLabel={onCreateLabel}
                            onClose={onLabelPickerClose}
                        />
                    )}
                </div>
            )}

            {/* Due date */}
            <div className="shrink-0 mx-2">
                <DueDatePicker
                    taskId={node.id}
                    current={node.due_date ?? null}
                    onSelect={onDueDateChange}
                    anchorEl={
                        <button
                            className={`flex items-center text-table-foreground font-medium border-table-secondary gap-2 h-7 hover:bg-node-hover px-2 rounded-full border-[0.5px] transition-colors text-sm ${!node.due_date ? 'opacity-70' : ''}`}
                            title="Set due date"
                        >
                            <HiCalendar size={14} className={isOverdue ? 'text-monday-error' : isSoon ? 'text-orange-400' : ''} />
                            <span>{node.due_date ? dueDateLabel : 'Due'}</span>
                        </button>
                    }
                />
            </div>

            {/* Estimate hours */}
            <div className="shrink-0 mx-2">
                {isEditingEstimate ? (
                    <input
                        ref={estimateInputRef}
                        type="number"
                        min="0"
                        step="0.5"
                        value={estimateValue}
                        onChange={(e) => setEstimateValue(e.target.value)}
                        onBlur={commitEstimate}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitEstimate(); }
                            if (e.key === 'Escape') { setIsEditingEstimate(false); setEstimateValue(String(node.estimate_hours ?? '')); }
                        }}
                        className="w-16 h-7 px-2 text-sm font-medium text-monday-dark bg-transparent border border-monday-blue rounded-full outline-none text-center"
                        autoFocus
                    />
                ) : (
                    <button
                        onClick={() => { setEstimateValue(String(node.estimate_hours ?? '')); setIsEditingEstimate(true); }}
                        className={`flex items-center gap-1 h-7 hover:bg-node-hover px-2 rounded-full border-[0.5px] border-table-secondary transition-colors text-sm font-medium text-table-foreground ${!displayedEstimate ? 'opacity-70' : ''}`}
                        title={nodeHasChildren ? 'Rolled up from subtasks' : 'Set estimate'}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{displayedEstimate ? `${displayedEstimate}h` : 'Est'}</span>
                    </button>
                )}
            </div>

            {/* Assignee avatars */}
            <div className="shrink-0 mx-2">
                <AssigneeAvatars
                    assignedUserIds={assigneeMap[node.id] ?? []}
                    users={mondayUsers}
                    buttonRef={avatarButtonRef}
                    onClick={() => !isTemp && (pickerOpenForId === node.id ? onPickerClose() : onPickerOpen(node.id))}
                />
                {!isTemp && pickerOpenForId === node.id && (
                    <AssigneePicker
                        taskId={node.id}
                        workspaceId={workspaceId}
                        assignedUserIds={assigneeMap[node.id] ?? []}
                        users={mondayUsers}
                        plan={plan}
                        anchorEl={avatarButtonRef.current}
                        onAssigneesChange={onAssigneesChange}
                        onClose={onPickerClose}
                    />
                )}
            </div>

            {/* Priority */}
            <div className="shrink-0 mx-2">
                <button
                    ref={priorityButtonRef}
                    onClick={() => priorityPickerOpenForId === node.id ? onPriorityPickerClose() : onPriorityPickerOpen(node.id)}
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-badge-bg transition-colors"
                    title={PRIORITIES.find((p) => p.value === (node.priority ?? 'no_priority'))?.label ?? 'No priority'}
                >
                    <PriorityIcon priority={(node.priority ?? 'no_priority') as Priority} />
                </button>
                {priorityPickerOpenForId === node.id && (
                    <PriorityPicker
                        taskId={node.id}
                        current={(node.priority ?? 'no_priority') as Priority}
                        anchorEl={priorityButtonRef.current}
                        onSelect={onPriorityChange}
                        onClose={onPriorityPickerClose}
                    />
                )}
            </div>

            {/* Created at */}
            <div className="shrink-0 mx-2 text-sm text-table-foreground font-medium">
                {new Date(node.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
        </div>
    );
});

export default NodeRow;
