'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TreeTask, TaskRollup } from '@/types';
import { buildTree, flattenTree, reorderNodes, computeRollups, isTaskBlocked } from '@/lib/tree-utils';
import { patchTaskPosition } from '@/services/tasks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DependencyGraph from '@/components/DependencyGraph';
import WorkloadView from '@/components/WorkloadView';
import PlanLimitBanner from '@/components/PlanLimitBanner';
import type { Status } from '@/components/StatusPicker';
import DragLayer from './DragLayer';
import BoardHeader from './BoardHeader';
import StatusGroup from './StatusGroup';
import { useTreeData } from './hooks/useTreeData';
import { useTreeActions } from './hooks/useTreeActions';
import { useTreeFilters } from './hooks/useTreeFilters';
import { EMPTY_FILTERS } from './FilterBar/types';
import { type TreeProps, STATUS_GROUPS } from './types';

export default function Tree({ initialTasks, board, workspace, onBack, onBoardRenamed, onBoardDeleted, onTaskCountChanged }: TreeProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeNode, setActiveNode] = useState<TreeTask | null>(null);
  const [overNodeId, setOverNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'graph' | 'workload'>('tree');

  // Picker open states — kept in Tree so only one opens at a time
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null);
  const [priorityPickerTaskId, setPriorityPickerTaskId] = useState<string | null>(null);
  const [statusPickerTaskId, setStatusPickerTaskId] = useState<string | null>(null);
  const [labelPickerTaskId, setLabelPickerTaskId] = useState<string | null>(null);

  useEffect(() => {
    onTaskCountChanged?.(board.id, tasks.length);
  }, [tasks.length, board.id]);

  const {
    mondayUsers,
    assigneeMap, setAssigneeMap,
    labels, setLabels,
    labelMap, setLabelMap,
    dependencyMap, setDependencyMap,
  } = useTreeData(board, workspace);

  const { filters, setFilters, filteredTasks } = useTreeFilters(tasks, assigneeMap, labelMap);

  const actions = useTreeActions({
    board, workspace, tasks, setTasks, initialTasks,
    selectedIds, assigneeMap, setAssigneeMap,
    setLabels, setLabelMap,
    dependencyMap, setDependencyMap,
  });

  const {
    editingNodeId,
    pendingDelete, setPendingDelete,
    limitError, setLimitError,
    boardName,
    isRenamingBoard, setIsRenamingBoard,
    boardRenameValue, setBoardRenameValue,
    pendingDeleteBoard, setPendingDeleteBoard,
  } = actions;

  // ── Derived tree data ──────────────────────────────────────────────────

  const groupedTrees = useMemo(() => {
    const raw = buildTree(filteredTasks);

    const applyCollapse = (arr: TreeTask[]): TreeTask[] =>
      arr.map((n) => ({
        ...n,
        isExpanded: !collapsedIds.has(n.id),
        children: applyCollapse(n.children),
      }));

    const withExpand = applyCollapse(raw);

    const groups = new Map<Status | null, TreeTask[]>();
    for (const sg of STATUS_GROUPS) groups.set(sg.status, []);
    for (const rootNode of withExpand) {
      const s = (rootNode.status ?? 'backlog') as Status;
      if (!groups.has(s)) groups.set(s, []);
      groups.get(s)!.push(rootNode);
    }
    return groups;
  }, [filteredTasks, collapsedIds]);

  const flatListByGroup = useMemo(() => {
    const result = new Map<Status | null, TreeTask[]>();
    for (const [status, roots] of groupedTrees) {
      result.set(status, flattenTree(roots));
    }
    return result;
  }, [groupedTrees]);

  const rollupMap = useMemo<Map<string, TaskRollup>>(() => computeRollups(tasks), [tasks]);

  const blockedIds = useMemo<Set<string>>(() => {
    const result = new Set<string>();
    for (const taskId of Object.keys(dependencyMap)) {
      if (isTaskBlocked(taskId, tasks, dependencyMap)) result.add(taskId);
    }
    return result;
  }, [tasks, dependencyMap]);

  const allSortableIds = useMemo(() => {
    const ids: string[] = [];
    for (const flat of flatListByGroup.values()) ids.push(...flat.map((n) => n.id));
    return ids;
  }, [flatListByGroup]);

  // ── DnD ───────────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    for (const flat of flatListByGroup.values()) {
      const found = flat.find((n) => n.id === event.active.id);
      if (found) { setActiveNode(found); return; }
    }
    setActiveNode(null);
  }, [flatListByGroup]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverNodeId((event.over?.id as string) ?? null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveNode(null);
    setOverNodeId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const { changed, nodes: updatedNodes } = reorderNodes({
      nodes: tasks,
      activeId: active.id as string,
      overId: over.id as string,
      dropAsChild: false,
    });
    if (changed.length === 0) return;

    setTasks(updatedNodes as Task[]);
    await Promise.all(
      changed.map((patch) =>
        patchTaskPosition({
          id: patch.id,
          parent_task_id: patch.parent_node_id,
          position: patch.position,
          depth: patch.depth,
        }).catch((err) => console.error('[Tree] Failed to persist task patch:', patch.id, err))
      )
    );
  }, [tasks]);

  // ── Select ────────────────────────────────────────────────────────────

  const handleSelect = useCallback((nodeId: string, checked: boolean) => {
    const collectIds = (id: string): string[] => {
      const children = tasks.filter((n) => n.parent_task_id === id);
      return [id, ...children.flatMap((c) => collectIds(c.id))];
    };
    const ids = collectIds(nodeId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }, [tasks]);

  // ── Toggle collapse ───────────────────────────────────────────────────

  const handleToggle = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  }, []);

  // ── Shared node props ─────────────────────────────────────────────────

  const sharedNodeProps = {
    onToggle: handleToggle,
    onRename: actions.handleRename,
    onAddChild: actions.handleAddChild,
    onDelete: actions.handleDelete,
    editingNodeId,
    onEditingDone: () => actions.setEditingNodeId(null),
    activeDropTargetId: overNodeId,
    selectedIds,
    onSelect: handleSelect,
    assigneeMap,
    mondayUsers,
    workspaceId: workspace.id,
    plan: workspace.plan,
    pickerOpenForId: pickerTaskId,
    onPickerOpen: (id: string) => setPickerTaskId(id),
    onPickerClose: () => setPickerTaskId(null),
    onAssigneesChange: actions.handleAssigneesChange,
    priorityPickerOpenForId: priorityPickerTaskId,
    onPriorityPickerOpen: (id: string) => setPriorityPickerTaskId(id),
    onPriorityPickerClose: () => setPriorityPickerTaskId(null),
    onPriorityChange: actions.handlePriorityChange,
    statusPickerOpenForId: statusPickerTaskId,
    onStatusPickerOpen: (id: string) => setStatusPickerTaskId(id),
    onStatusPickerClose: () => setStatusPickerTaskId(null),
    onStatusChange: actions.handleStatusChange,
    onDueDateChange: actions.handleDueDateChange,
    labels,
    labelMap,
    labelPickerOpenForId: labelPickerTaskId,
    onLabelPickerOpen: (id: string) => setLabelPickerTaskId(id),
    onLabelPickerClose: () => setLabelPickerTaskId(null),
    onLabelsChange: actions.handleLabelsChange,
    onCreateLabel: actions.handleCreateLabel,
    onBulkStatusChange: actions.handleBulkStatusChange,
    onBulkPriorityChange: actions.handleBulkPriorityChange,
    onBulkLabelsChange: actions.handleBulkLabelsChange,
    onBulkAssigneesChange: actions.handleBulkAssigneesChange,
    rollupMap,
    onEstimateChange: actions.handleEstimateChange,
    dependencyMap,
    blockedIds,
    allTasksFlat: tasks.map((t) => ({ id: t.id, title: t.title })),
    onAddDependency: actions.handleAddDependency,
    onRemoveDependency: actions.handleRemoveDependency,
  };

  const totalCount = tasks.length;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>

          <BoardHeader
            boardName={boardName}
            totalCount={totalCount}
            isRenamingBoard={isRenamingBoard}
            boardRenameValue={boardRenameValue}
            onBoardRenameValueChange={setBoardRenameValue}
            onCommitBoardRename={() => actions.commitBoardRename(onBoardRenamed)}
            onCancelBoardRename={() => { setIsRenamingBoard(false); setBoardRenameValue(boardName); }}
            onStartBoardRename={() => { setBoardRenameValue(boardName); setIsRenamingBoard(true); }}
            onBack={onBack}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddTask={() => actions.handleAddRoot(null)}
            filters={filters}
            onFiltersChange={setFilters}
            mondayUsers={mondayUsers}
            labels={labels}
          />

          {limitError && (
            <PlanLimitBanner
              error={limitError}
              plan={workspace.plan}
              onDismiss={() => setLimitError(null)}
            />
          )}

          {viewMode === 'graph' && (
            <DependencyGraph
              tasks={tasks}
              dependencyMap={dependencyMap}
              onAddDependency={actions.handleAddDependency}
              onRemoveDependency={actions.handleRemoveDependency}
            />
          )}

          {viewMode === 'workload' && (
            <WorkloadView
              tasks={tasks}
              assigneeMap={assigneeMap}
              mondayUsers={mondayUsers}
            />
          )}

          {viewMode === 'tree' && tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <svg className="w-12 h-12 text-border-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <p className="text-sm font-medium text-monday-dark">No tasks yet</p>
                <p className="text-xs text-icon-muted mt-0.5">Add your first task to get started</p>
              </div>
              <button
                onClick={() => actions.handleAddRoot(null)}
                className="mt-1 px-3 py-1.5 text-xs font-medium text-white bg-monday-blue rounded-lg hover:bg-monday-blue-hover transition-colors"
              >
                Add task
              </button>
            </div>
          )}

          {viewMode === 'tree' && tasks.length > 0 && filteredTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <svg className="w-12 h-12 text-border-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-monday-dark">No matching tasks</p>
                <p className="text-xs text-icon-muted mt-0.5">Try adjusting your filters</p>
              </div>
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-1 px-3 py-1.5 text-xs font-medium text-monday-blue bg-monday-blue/10 rounded-lg hover:bg-monday-blue/20 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {viewMode === 'tree' && STATUS_GROUPS.map(({ status, label, color }) => {
            const groupKey = status ?? '__null__';
            return (
              <StatusGroup
                key={groupKey}
                status={status}
                label={label}
                color={color}
                rootNodes={groupedTrees.get(status) ?? []}
                isCollapsed={collapsedIds.has(`__group__${groupKey}`)}
                onToggleCollapse={() => handleToggle(`__group__${groupKey}`)}
                onAddTask={() => actions.handleAddRoot(status)}
                sharedNodeProps={sharedNodeProps}
              />
            );
          })}

        </SortableContext>

        <DragLayer activeNode={activeNode} />
      </DndContext>

      <AlertDialog open={pendingDeleteBoard} onOpenChange={(open) => { if (!open) setPendingDeleteBoard(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{boardName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this board and all its tasks. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actions.confirmDeleteBoard(onBoardDeleted)}
              className="bg-monday-error hover:bg-monday-error/90 text-white"
            >
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task{pendingDelete?.hasChildren ? ' & subtasks' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.hasChildren
                ? 'This will permanently delete this task and all its subtasks. This cannot be undone.'
                : 'This will permanently delete this task. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={actions.confirmDelete}
              className="bg-monday-error hover:bg-monday-error/90 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
