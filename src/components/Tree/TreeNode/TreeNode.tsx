'use client';

import React, { useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ContextMenu,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { TreeTask, MondayUser, Plan, TaskRollup, DependencyMap } from '@/types';
import type { Label } from '@/components/LabelPicker';
import type { Priority } from '@/components/PriorityPicker';
import type { Status } from '@/components/StatusPicker';
import NodeRow, { type NodeRowHandle } from './NodeRow';
import NodeContextMenu from './NodeContextMenu';

export interface TreeNodeProps {
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
    onBulkStatusChange: (status: Status | null) => void;
    onBulkPriorityChange: (priority: Priority) => void;
    onBulkLabelsChange: (labelIds: string[]) => void;
    onBulkAssigneesChange: (userIds: string[]) => void;
    rollupMap: Map<string, TaskRollup>;
    onEstimateChange: (taskId: string, hours: number | null) => void;
    dependencyMap: DependencyMap;
    blockedIds: Set<string>;
    allTasksFlat: { id: string; title: string }[];
    onAddDependency: (taskId: string, dependsOnId: string) => void;
    onRemoveDependency: (taskId: string, dependsOnId: string) => void;
}

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
    onDueDateChange,
    labels,
    labelMap,
    labelPickerOpenForId,
    onLabelPickerOpen,
    onLabelPickerClose,
    onLabelsChange,
    onCreateLabel,
    onBulkStatusChange,
    onBulkPriorityChange,
    onBulkLabelsChange,
    onBulkAssigneesChange,
    rollupMap,
    onEstimateChange,
    dependencyMap,
    blockedIds,
    allTasksFlat,
    onAddDependency,
    onRemoveDependency,
}: TreeNodeProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: node.id,
        data: { type: 'TreeNode', node },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
    };

    const rowRef = useRef<NodeRowHandle>(null);
    const isTemp = node.id.startsWith('__temp__');
    const isDropTarget = activeDropTargetId === node.id;

    const childProps: TreeNodeProps = {
        node, // will be overridden per child below
        onToggle, onRename, onAddChild, onDelete,
        editingNodeId, onEditingDone, activeDropTargetId,
        selectedIds, onSelect,
        assigneeMap, mondayUsers, workspaceId, plan,
        pickerOpenForId, onPickerOpen, onPickerClose, onAssigneesChange,
        priorityPickerOpenForId, onPriorityPickerOpen, onPriorityPickerClose, onPriorityChange,
        statusPickerOpenForId, onStatusPickerOpen, onStatusPickerClose, onStatusChange,
        onDueDateChange,
        labels, labelMap,
        labelPickerOpenForId, onLabelPickerOpen, onLabelPickerClose, onLabelsChange, onCreateLabel,
        onBulkStatusChange, onBulkPriorityChange, onBulkLabelsChange, onBulkAssigneesChange,
        rollupMap, onEstimateChange,
        dependencyMap, blockedIds, allTasksFlat, onAddDependency, onRemoveDependency,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div>
                        <NodeRow
                            ref={rowRef}
                            node={node}
                            onToggle={onToggle}
                            onRename={onRename}
                            editingNodeId={editingNodeId}
                            onEditingDone={onEditingDone}
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
                            onDueDateChange={onDueDateChange}
                            labels={labels}
                            labelMap={labelMap}
                            labelPickerOpenForId={labelPickerOpenForId}
                            onLabelPickerOpen={onLabelPickerOpen}
                            onLabelPickerClose={onLabelPickerClose}
                            onLabelsChange={onLabelsChange}
                            onCreateLabel={onCreateLabel}
                            rollupMap={rollupMap}
                            onEstimateChange={onEstimateChange}
                            dependencyMap={dependencyMap}
                            blockedIds={blockedIds}
                            dragHandleProps={{ ...attributes, ...listeners } as Record<string, unknown>}
                            isDropTarget={isDropTarget}
                        />
                    </div>
                </ContextMenuTrigger>

                <NodeContextMenu
                    node={node}
                    selectedIds={selectedIds}
                    isTemp={isTemp}
                    assigneeMap={assigneeMap}
                    mondayUsers={mondayUsers}
                    workspaceId={workspaceId}
                    plan={plan}
                    onAssigneesChange={onAssigneesChange}
                    onBulkAssigneesChange={onBulkAssigneesChange}
                    onStatusChange={onStatusChange}
                    onBulkStatusChange={onBulkStatusChange}
                    onPriorityChange={onPriorityChange}
                    onBulkPriorityChange={onBulkPriorityChange}
                    labels={labels}
                    labelMap={labelMap}
                    onLabelsChange={onLabelsChange}
                    onBulkLabelsChange={onBulkLabelsChange}
                    onCreateLabel={onCreateLabel}
                    dependencyMap={dependencyMap}
                    allTasksFlat={allTasksFlat}
                    onAddDependency={onAddDependency}
                    onRemoveDependency={onRemoveDependency}
                    onStartEditing={() => rowRef.current?.startEditing()}
                    onAddChild={onAddChild}
                    onDelete={onDelete}
                />
            </ContextMenu>

            {/* Children */}
            {node.isExpanded !== false && node.children.length > 0 && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            {...childProps}
                            node={child}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
