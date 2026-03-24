'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { TreeTask, MondayUser, Plan } from '@/types';
import { TREE_CONFIG } from '@/config/tree';
import AssigneeAvatars from '@/components/AssigneeAvatars';
import AssigneePicker, { AssigneePickerContent } from '@/components/AssigneePicker';
import PriorityPicker, { PriorityPickerContent, type Priority, PRIORITIES } from '@/components/PriorityPicker';
import StatusPicker, { StatusPickerContent, type Status, STATUSES, StatusDot } from '@/components/StatusPicker';
import { DueDatePicker, formatDueDate, isDueDateOverdue } from '@/components/DueDatePicker';
import { HiCalendar } from "react-icons/hi2";
import LabelPicker, { LabelPickerContent, LabelChip, type Label } from '@/components/LabelPicker';


interface TreeNodeProps {
    node: TreeTask;
    onToggle: (nodeId: string) => void;
    onRename: (taskId: string, newTitle: string) => Promise<void>;
    onAddChild: (parentNodeId: string) => void;
    onDelete: (nodeId: string, hasChildren: boolean) => void;
    editingNodeId?: string | null;
    onEditingDone?: () => void;
    activeDropTargetId?: string | null;
    selectedIds: Set<string>;
    onSelect: (nodeId: string, checked: boolean) => void;
    // Assignees
    assigneeMap: Record<string, string[]>;
    mondayUsers: MondayUser[];
    workspaceId: string;
    plan: Plan;
    pickerOpenForId: string | null;
    onPickerOpen: (taskId: string) => void;
    onPickerClose: () => void;
    onAssigneesChange: (taskId: string, userIds: string[]) => void;
    // Priority
    priorityPickerOpenForId: string | null;
    onPriorityPickerOpen: (taskId: string) => void;
    onPriorityPickerClose: () => void;
    onPriorityChange: (taskId: string, priority: Priority) => void;
    // Status
    statusPickerOpenForId: string | null;
    onStatusPickerOpen: (taskId: string) => void;
    onStatusPickerClose: () => void;
    onStatusChange: (taskId: string, status: Status | null) => void;
    // Due date
    dueDatePickerOpenForId: string | null;
    onDueDatePickerOpen: (taskId: string) => void;
    onDueDatePickerClose: () => void;
    onDueDateChange: (taskId: string, date: string | null) => void;
    // Labels
    labels: Label[];
    labelMap: Record<string, string[]>;
    labelPickerOpenForId: string | null;
    onLabelPickerOpen: (taskId: string) => void;
    onLabelPickerClose: () => void;
    onLabelsChange: (taskId: string, labelIds: string[]) => void;
    onCreateLabel: (name: string, color: string) => Promise<Label>;
}

// ── Context menu helpers ────────────────────────────────────────────────────

function AssigneeCtxIcon() {
    return (
        <svg className="w-4 h-4 shrink-0 text-monday-dark-secondary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" />
        </svg>
    );
}


function PriorityIcon({ priority }: { priority: Priority }) {
    const color = PRIORITIES.find((p) => p.value === priority)?.color ?? '#c8cad0';
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <rect x="1" y="1" width="14" height="14" rx="3" stroke={color} strokeWidth="2" fill="none" />
            <rect x="4" y="4" width="8" height="8" rx="1.5" fill={color} />
        </svg>
    );
}

// ───────────────────────────────────────────────────────────────────────────

export default function TreeNode({
    node,
    onToggle,
    onRename,
    onAddChild,
    onDelete,
    editingNodeId,
    onEditingDone,
    activeDropTargetId,
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
    dueDatePickerOpenForId,
    onDueDatePickerOpen,
    onDueDatePickerClose,
    onDueDateChange,
    labels,
    labelMap,
    labelPickerOpenForId,
    onLabelPickerOpen,
    onLabelPickerClose,
    onLabelsChange,
    onCreateLabel,
}: TreeNodeProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(node.title ?? '');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const justFocusedRef = useRef(false);

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

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: node.id,
        data: { type: 'TreeNode', node },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
    };

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
    const dueDateButtonRef = useRef<HTMLButtonElement>(null);
    const hasChildren = node.children.length > 0;
    const isExpanded = node.isExpanded !== false;
    const isDropTarget = activeDropTargetId === node.id;
    const dueDateLabel = formatDueDate(node.due_date ?? null);
    const isOverdue = isDueDateOverdue(node.due_date ?? null);
    const isSoon = ['Today', 'Tomorrow'].includes(dueDateLabel);

    return (
        <div ref={setNodeRef} style={style}>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        className={[
                            `group relative flex items-center ${TREE_CONFIG.rowHeight} text-table-foreground rounded-lg bg-surface transition-colors duration-75 cursor-default select-none`,
                            isDropTarget ? 'bg-blue-50' : selectedIds.has(node.id) ? 'bg-node-selected' : 'hover:bg-node-hover',
                        ].join(' ')}
                    >
                        {/* Indent for depth */}
                        <div style={{ width: node.depth * TREE_CONFIG.indentPx + 4 }} className="shrink-0" />

                        {/* Drag handle — visible on hover */}
                        <div
                            {...attributes}
                            {...listeners}
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

                        {/* Checkbox — left side, visible on hover or when checked */}
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

                        {/* Status icon — left of title */}
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
                                        ref={dueDateButtonRef}
                                        className={`flex items-center text-table-foreground font-medium border-table-secondary gap-2 h-7 hover:bg-node-hover px-2 rounded-full border-[0.5px] transition-colors text-sm ${!node.due_date ? 'opacity-70' : ''}`}
                                        title="Set due date"
                                    >
                                        <HiCalendar size={14} className={isOverdue ? 'text-monday-error' : isSoon ? 'text-orange-400' : ''} />
                                        <span>{node.due_date ? dueDateLabel : 'Due'}</span>
                                    </button>
                                }
                            />
                        </div>


                        {/* Assignee avatars */}
                        <div className="shrink-0 mx-2">
                            <AssigneeAvatars
                                assignedUserIds={assigneeMap[node.id] ?? []}
                                users={mondayUsers}
                                buttonRef={avatarButtonRef}
                                onClick={() => pickerOpenForId === node.id ? onPickerClose() : onPickerOpen(node.id)}
                            />
                            {pickerOpenForId === node.id && (
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
                </ContextMenuTrigger>

                {/* Context menu */}
                <ContextMenuContent className="w-56 rounded-xl border border-border-subtle shadow-lg p-1.5">
                    {/* Assignee submenu */}
                    <ContextMenuSub>
                        <ContextMenuSubTrigger className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg px-2 py-1.5`}>
                            <AssigneeCtxIcon />
                            <span className="flex-1">Assignee</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-64 rounded-xl border border-border-subtle shadow-lg p-0 overflow-hidden">
                            <AssigneePickerContent
                                taskId={node.id}
                                workspaceId={workspaceId}
                                assignedUserIds={assigneeMap[node.id] ?? []}
                                users={mondayUsers}
                                plan={plan}
                                onAssigneesChange={onAssigneesChange}
                                onClose={() => { }}
                            />
                        </ContextMenuSubContent>
                    </ContextMenuSub>

                    {/* Status submenu */}
                    <ContextMenuSub>
                        <ContextMenuSubTrigger className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg px-2 py-1.5`}>
                            <StatusDot color={STATUSES.find((s) => s.value === node.status)?.color ?? '#e0e0e0'} />
                            <span className="flex-1">Status</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48 rounded-xl border border-border-subtle shadow-lg p-0 overflow-hidden">
                            <StatusPickerContent
                                taskId={node.id}
                                current={node.status as Status | null}
                                onSelect={onStatusChange}
                                onClose={() => { }}
                            />
                        </ContextMenuSubContent>
                    </ContextMenuSub>

                    {/* Priority submenu */}
                    <ContextMenuSub>
                        <ContextMenuSubTrigger className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg px-2 py-1.5`}>
                            <PriorityIcon priority={(node.priority ?? 'no_priority') as Priority} />
                            <span className="flex-1">Priority</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-52 rounded-xl border border-border-subtle shadow-lg p-0 overflow-hidden">
                            <PriorityPickerContent
                                taskId={node.id}
                                current={(node.priority ?? 'no_priority') as Priority}
                                onSelect={onPriorityChange}
                                onClose={() => { }}
                            />
                        </ContextMenuSubContent>
                    </ContextMenuSub>

                    {/* Labels submenu */}
                    <ContextMenuSub>
                        <ContextMenuSubTrigger className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg px-2 py-1.5`}>
                            <LabelCtxIcon />
                            <span className="flex-1">Labels</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-56 rounded-xl border border-border-subtle shadow-lg p-0 overflow-hidden">
                            <LabelPickerContent
                                taskId={node.id}
                                plan={plan}
                                assignedLabelIds={labelMap[node.id] ?? []}
                                labels={labels}
                                onLabelsChange={onLabelsChange}
                                onCreateLabel={onCreateLabel}
                                onClose={() => {}}
                            />
                        </ContextMenuSubContent>
                    </ContextMenuSub>

                    <ContextMenuSeparator />

                    <ContextMenuItem className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg`} onClick={startEditing}>
                        <PencilIcon /> Rename
                    </ContextMenuItem>
                    <ContextMenuItem className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg`} onClick={() => onAddChild(node.id)}>
                        <SubitemIcon /> Add subtask
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg`}
                        onClick={() => onDelete(node.id, hasChildren)}
                    >
                        <TrashIcon /> Delete{hasChildren ? ' task & subtasks' : ''}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            onToggle={onToggle}
                            onRename={onRename}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                            editingNodeId={editingNodeId}
                            onEditingDone={onEditingDone}
                            activeDropTargetId={activeDropTargetId}
                            selectedIds={selectedIds}
                            onSelect={onSelect}
                            assigneeMap={assigneeMap}
                            mondayUsers={mondayUsers}
                            workspaceId={workspaceId}
                            plan={plan}
                            pickerOpenForId={pickerOpenForId}
                            onPickerOpen={onPickerOpen}
                            onPickerClose={onPickerClose}
                            onAssigneesChange={onAssigneesChange}
                            priorityPickerOpenForId={priorityPickerOpenForId}
                            onPriorityPickerOpen={onPriorityPickerOpen}
                            onPriorityPickerClose={onPriorityPickerClose}
                            onPriorityChange={onPriorityChange}
                            statusPickerOpenForId={statusPickerOpenForId}
                            onStatusPickerOpen={onStatusPickerOpen}
                            onStatusPickerClose={onStatusPickerClose}
                            onStatusChange={onStatusChange}
                            dueDatePickerOpenForId={dueDatePickerOpenForId}
                            onDueDatePickerOpen={onDueDatePickerOpen}
                            onDueDatePickerClose={onDueDatePickerClose}
                            onDueDateChange={onDueDateChange}
                            labels={labels}
                            labelMap={labelMap}
                            labelPickerOpenForId={labelPickerOpenForId}
                            onLabelPickerOpen={onLabelPickerOpen}
                            onLabelPickerClose={onLabelPickerClose}
                            onLabelsChange={onLabelsChange}
                            onCreateLabel={onCreateLabel}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function LabelCtxIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" />
        </svg>
    );
}

function PencilIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

function SubitemIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M12 15V3M5 3h14" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l4 4-4 4" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline strokeLinecap="round" strokeLinejoin="round" points="3 6 5 6 21 6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
    );
}