'use client';

import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import type { TreeTask, MondayUser, Plan, DependencyMap } from '@/types';
import { TREE_CONFIG } from '@/config/tree';
import { AssigneePickerContent } from '@/components/AssigneePicker';
import { PriorityPickerContent, PRIORITIES } from '@/components/PriorityPicker';
import type { Priority } from '@/components/PriorityPicker';
import { StatusPickerContent, StatusDot, STATUSES } from '@/components/StatusPicker';
import type { Status } from '@/components/StatusPicker';
import { LabelPickerContent } from '@/components/LabelPicker';
import type { Label } from '@/components/LabelPicker';
import { DependencyPickerContent } from '@/components/DependencyPicker';
import {
    AssigneeCtxIcon,
    PriorityIcon,
    LabelCtxIcon,
    PencilIcon,
    SubitemIcon,
    DependencyIcon,
    TrashIcon,
} from './icons';

export interface NodeContextMenuProps {
    node: TreeTask;
    selectedIds: Set<string>;
    isTemp: boolean;
    // Assignees
    assigneeMap: Record<string, string[]>;
    mondayUsers: MondayUser[];
    workspaceId: string;
    plan: Plan;
    onAssigneesChange: (taskId: string, userIds: string[]) => void;
    onBulkAssigneesChange: (userIds: string[]) => void;
    // Status
    onStatusChange: (taskId: string, status: Status | null) => void;
    onBulkStatusChange: (status: Status | null) => void;
    // Priority
    onPriorityChange: (taskId: string, priority: Priority) => void;
    onBulkPriorityChange: (priority: Priority) => void;
    // Labels
    labels: Label[];
    labelMap: Record<string, string[]>;
    onLabelsChange: (taskId: string, labelIds: string[]) => void;
    onBulkLabelsChange: (labelIds: string[]) => void;
    onCreateLabel: (name: string, color: string) => Promise<Label>;
    // Dependencies
    dependencyMap: DependencyMap;
    allTasksFlat: { id: string; title: string }[];
    onAddDependency: (taskId: string, dependsOnId: string) => void;
    onRemoveDependency: (taskId: string, dependsOnId: string) => void;
    // Actions
    onStartEditing: () => void;
    onAddChild: (parentNodeId: string) => void;
    onDelete: (nodeId: string, hasChildren: boolean) => void;
}

export default function NodeContextMenu({
    node,
    selectedIds,
    isTemp,
    assigneeMap,
    mondayUsers,
    workspaceId,
    plan,
    onAssigneesChange,
    onBulkAssigneesChange,
    onStatusChange,
    onBulkStatusChange,
    onPriorityChange,
    onBulkPriorityChange,
    labels,
    labelMap,
    onLabelsChange,
    onBulkLabelsChange,
    onCreateLabel,
    dependencyMap,
    allTasksFlat,
    onAddDependency,
    onRemoveDependency,
    onStartEditing,
    onAddChild,
    onDelete,
}: NodeContextMenuProps) {
    const isMultiSelected = selectedIds.size > 1 && selectedIds.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
        <ContextMenuContent className="w-56 rounded-xl border border-border-subtle shadow-lg p-1.5">
            {/* Assignee submenu */}
            {!isTemp && (
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
                            onAssigneesChange={isMultiSelected ? (_, userIds) => onBulkAssigneesChange(userIds) : onAssigneesChange}
                            onClose={() => {}}
                        />
                    </ContextMenuSubContent>
                </ContextMenuSub>
            )}

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
                        onSelect={isMultiSelected ? (_, status) => onBulkStatusChange(status) : onStatusChange}
                        onClose={() => {}}
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
                        onSelect={isMultiSelected ? (_, priority) => onBulkPriorityChange(priority) : onPriorityChange}
                        onClose={() => {}}
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
                        assignedLabelIds={isMultiSelected ? [] : (labelMap[node.id] ?? [])}
                        labels={labels}
                        onLabelsChange={isMultiSelected ? (_, labelIds) => onBulkLabelsChange(labelIds) : onLabelsChange}
                        onCreateLabel={onCreateLabel}
                        onClose={() => {}}
                    />
                </ContextMenuSubContent>
            </ContextMenuSub>

            {/* Dependencies */}
            {!isMultiSelected && !isTemp && (
                <ContextMenuSub>
                    <ContextMenuSubTrigger className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg px-2 py-1.5`}>
                        <DependencyIcon />
                        <span className="flex-1">Dependencies</span>
                        {(dependencyMap[node.id] ?? []).length > 0 && (
                            <span className="text-xs text-icon-muted">{(dependencyMap[node.id] ?? []).length}</span>
                        )}
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-64 rounded-xl border border-border-subtle shadow-lg p-0 overflow-hidden">
                        <DependencyPickerContent
                            taskId={node.id}
                            allTasksFlat={allTasksFlat}
                            dependencyMap={dependencyMap}
                            onAddDependency={onAddDependency}
                            onRemoveDependency={onRemoveDependency}
                            onClose={() => {}}
                        />
                    </ContextMenuSubContent>
                </ContextMenuSub>
            )}

            <ContextMenuSeparator />

            {!isMultiSelected && (
                <ContextMenuItem className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg`} onClick={onStartEditing}>
                    <PencilIcon /> Rename
                </ContextMenuItem>
            )}
            {!isMultiSelected && (
                <ContextMenuItem className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg`} onClick={() => onAddChild(node.id)}>
                    <SubitemIcon /> Add subtask
                </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
                className={`${TREE_CONFIG.fontSize} gap-2 rounded-lg`}
                onClick={() => onDelete(node.id, hasChildren)}
            >
                <TrashIcon /> Delete{isMultiSelected ? ` ${selectedIds.size} tasks` : hasChildren ? ' task & subtasks' : ''}
            </ContextMenuItem>
        </ContextMenuContent>
    );
}
