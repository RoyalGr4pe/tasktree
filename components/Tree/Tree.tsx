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
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TreeTask, Task, PatchTaskPayload, Board, Workspace, PlanLimitError, MondayUser, TaskAssignee } from '@/types';
import type { Label } from '@/components/LabelPicker';
import type { Priority } from '@/components/PriorityPicker';
import type { Status } from '@/components/StatusPicker';
import { StatusDot } from '@/components/StatusPicker';
import { buildTree, flattenTree, reorderNodes } from '@/lib/tree-utils';
import TreeNode from './TreeNode';
import DragLayer from './DragLayer';
import PlanLimitBanner from '@/components/PlanLimitBanner';
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

interface TreeProps {
  initialTasks: Task[];
  board: Board;
  workspace: Workspace;
  onBack: () => void;
}

// Status groups in display order. null status tasks fall into the Backlog group.
const STATUS_GROUPS: Array<{ status: Status | null; label: string; color: string }> = [
  { status: null,          label: 'Backlog',      color: '#9ba0aa' },
  { status: 'backlog',     label: 'Backlog',      color: '#9ba0aa' },
  { status: 'todo',        label: 'To Do',        color: '#6366f1' },
  { status: 'in_progress', label: 'In Progress',  color: '#f0c446' },
  { status: 'in_review',   label: 'In Review',    color: '#f97316' },
  { status: 'done',        label: 'Done',         color: '#22c55e' },
];

export default function Tree({ initialTasks, board, workspace, onBack }: TreeProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeNode, setActiveNode] = useState<TreeTask | null>(null);
  const [overNodeId, setOverNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ nodeId: string; hasChildren: boolean } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [limitError, setLimitError] = useState<PlanLimitError | null>(null);

  // Assignees: map of taskId → userId[]
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string[]>>({});
  // All monday users for the workspace (fetched once)
  const [mondayUsers, setMondayUsers] = useState<MondayUser[]>([]);
  // Which task's picker is open
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null);
  // Which task's priority picker is open
  const [priorityPickerTaskId, setPriorityPickerTaskId] = useState<string | null>(null);
  // Which task's status picker is open
  const [statusPickerTaskId, setStatusPickerTaskId] = useState<string | null>(null);
  // Which task's due date picker is open
  const [dueDatePickerTaskId, setDueDatePickerTaskId] = useState<string | null>(null);
  // Labels for the workspace
  const [labels, setLabels] = useState<Label[]>([]);
  // Map of taskId → labelId[]
  const [labelMap, setLabelMap] = useState<Record<string, string[]>>({});
  // Which task's label picker is open
  const [labelPickerTaskId, setLabelPickerTaskId] = useState<string | null>(null);

  // Fetch monday users + all assignees + labels on mount
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then(({ users }) => setMondayUsers(users ?? []))
      .catch((err) => console.error('[Tree] Failed to fetch users:', err));

    fetch(`/api/tasks/assignees?board_id=${board.id}`)
      .then((r) => r.json())
      .then(({ assignees }: { assignees: (TaskAssignee & { task_id: string })[] }) => {
        const map: Record<string, string[]> = {};
        for (const a of assignees ?? []) {
          if (!map[a.task_id]) map[a.task_id] = [];
          map[a.task_id].push(a.user_id);
        }
        setAssigneeMap(map);
      })
      .catch((err) => console.error('[Tree] Failed to fetch assignees:', err));

    fetch(`/api/labels?workspace_id=${workspace.id}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) { console.error('[Tree] Labels API error:', r.status, body); return; }
setLabels(body.labels ?? []);
      })
      .catch((err) => console.error('[Tree] Failed to fetch labels:', err));

    fetch(`/api/task-labels?board_id=${board.id}`)
      .then((r) => r.json())
      .then(({ taskLabels }: { taskLabels: { task_id: string; label_id: string }[] }) => {
        const map: Record<string, string[]> = {};
        for (const tl of taskLabels ?? []) {
          if (!map[tl.task_id]) map[tl.task_id] = [];
          map[tl.task_id].push(tl.label_id);
        }
        setLabelMap(map);
      })
      .catch((err) => console.error('[Tree] Failed to fetch task labels:', err));
  }, [board.id, workspace.id]);

  const handleLabelsChange = useCallback(async (taskId: string, labelIds: string[]) => {
    setLabelMap((prev) => ({ ...prev, [taskId]: labelIds }));
    await fetch('/api/task-labels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, board_id: board.id, label_ids: labelIds }),
    }).catch((err) => console.error('[Tree] Failed to persist labels:', err));
  }, [board.id]);

  const handleCreateLabel = useCallback(async (name: string, color: string): Promise<Label> => {
    const res = await fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspace.id, name, color }),
    });
    const { label } = await res.json();
    setLabels((prev) => [...prev, label]);
    return label;
  }, [workspace.id]);

  function handleAssigneesChange(taskId: string, userIds: string[]) {
    setAssigneeMap((prev) => ({ ...prev, [taskId]: userIds }));
  }

  const handlePriorityChange = useCallback(async (taskId: string, priority: Priority) => {
    const normalised = priority === 'no_priority' ? null : priority;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, priority: normalised } : t));
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: normalised }),
    }).catch((err) => console.error('[Tree] Failed to persist priority:', err));
  }, []);

  const handleStatusChange = useCallback(async (taskId: string, status: Status | null) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch((err) => console.error('[Tree] Failed to persist status:', err));
  }, []);

  const handleDueDateChange = useCallback(async (taskId: string, due_date: string | null) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, due_date } : t));
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ due_date }),
    }).catch((err) => console.error('[Tree] Failed to persist due date:', err));
  }, []);

  // ---------------------------------------------------------------------------
  // Derived tree data — grouped by root task status
  // ---------------------------------------------------------------------------

  /**
   * Build the full tree and group ROOT tasks by their status.
   * Subtasks always travel with their root ancestor's group.
   */
  const groupedTrees = useMemo(() => {
    const raw = buildTree(tasks);

    const applyCollapse = (arr: TreeTask[]): TreeTask[] =>
      arr.map((n) => ({
        ...n,
        isExpanded: !collapsedIds.has(n.id),
        children: applyCollapse(n.children),
      }));

    const withExpand = applyCollapse(raw);

    // Group root tasks by their own status
    const groups = new Map<Status | null, TreeTask[]>();
    for (const statusGroup of STATUS_GROUPS) {
      groups.set(statusGroup.status, []);
    }
    for (const rootNode of withExpand) {
      const s = (rootNode.status ?? null) as Status | null;
      if (!groups.has(s)) groups.set(s, []);
      groups.get(s)!.push(rootNode);
    }
    return groups;
  }, [tasks, collapsedIds]);

  // Flat list per group (for DnD sortable IDs)
  const flatListByGroup = useMemo(() => {
    const result = new Map<Status | null, TreeTask[]>();
    for (const [status, roots] of groupedTrees) {
      result.set(status, flattenTree(roots));
    }
    return result;
  }, [groupedTrees]);

  // All flat IDs across all groups (needed for DnD context)
  const allSortableIds = useMemo(() => {
    const ids: string[] = [];
    for (const flat of flatListByGroup.values()) {
      ids.push(...flat.map((n) => n.id));
    }
    return ids;
  }, [flatListByGroup]);

  // ---------------------------------------------------------------------------
  // DnD
  // ---------------------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      for (const flat of flatListByGroup.values()) {
        const found = flat.find((n) => n.id === event.active.id);
        if (found) { setActiveNode(found); return; }
      }
      setActiveNode(null);
    },
    [flatListByGroup]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverNodeId((event.over?.id as string) ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
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
          patchTask({
            id: patch.id,
            parent_task_id: patch.parent_node_id,
            position: patch.position,
            depth: patch.depth,
          }).catch((err) =>
            console.error('[Tree] Failed to persist task patch:', patch.id, err)
          )
        )
      );
    },
    [tasks]
  );

  // ---------------------------------------------------------------------------
  // Select
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Expand / collapse
  // ---------------------------------------------------------------------------

  const handleToggle = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Create task
  // ---------------------------------------------------------------------------

  async function createTask(parentTaskId: string | null) {
    // Optimistic: insert a placeholder immediately so the UI responds instantly
    const tempId = `__temp__${Date.now()}`;
    const parent = parentTaskId ? tasks.find((t) => t.id === parentTaskId) : null;
    const siblings = tasks.filter((t) => t.parent_task_id === parentTaskId);
    const optimisticTask: Task = {
      id: tempId,
      board_id: board.id,
      workspace_id: workspace.id,
      parent_task_id: parentTaskId,
      parent_node_id: parentTaskId,
      title: '',
      name: '',
      position: siblings.length,
      depth: parent ? parent.depth + 1 : 0,
      priority: null,
      status: null,
      due_date: null,
      created_at: new Date().toISOString(),
      linked_monday_item_id: null,
    };

    setTasks((prev) => [...prev, optimisticTask]);

    if (parentTaskId) {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        next.delete(parentTaskId);
        return next;
      });
    }

    setEditingNodeId(tempId);

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: board.id,
        workspace_id: workspace.id,
        parent_task_id: parentTaskId,
        title: '',
      }),
    });

    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      // Roll back the optimistic task
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setEditingNodeId(null);
      setLimitError(body.error as PlanLimitError);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setEditingNodeId(null);
      throw new Error(err.error ?? 'Failed to create task');
    }

    const { task: newTask }: { task: Task } = await res.json();

    // Swap the temp placeholder for the real task, and update the editing target
    setTasks((prev) => prev.map((t) => t.id === tempId ? newTask : t));
    setEditingNodeId(newTask.id);
  }

  const handleAddRoot = useCallback(() => {
    createTask(null).catch((err) => console.error('[Tree] Failed to add root task:', err));
  }, [board.id, workspace.id]);

  const handleAddChild = useCallback((parentNodeId: string) => {
    createTask(parentNodeId).catch((err) => console.error('[Tree] Failed to add child task:', err));
  }, [board.id, workspace.id]);

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback((nodeId: string, hasChildren: boolean) => {
    setPendingDelete({ nodeId, hasChildren });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const { nodeId } = pendingDelete;
    setPendingDelete(null);

    const collectIds = (id: string): string[] => {
      const children = tasks.filter((n) => n.parent_task_id === id);
      return [id, ...children.flatMap((c) => collectIds(c.id))];
    };
    const idsToRemove = new Set(collectIds(nodeId));

    setTasks((prev) => prev.filter((n) => !idsToRemove.has(n.id)));

    try {
      const res = await fetch(`/api/tasks/${nodeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Delete failed');
      }
    } catch (err) {
      console.error('[Tree] Delete failed, restoring tasks:', err);
      setTasks(tasks);
    }
  }, [pendingDelete, tasks]);

  // ---------------------------------------------------------------------------
  // Rename
  // ---------------------------------------------------------------------------

  const handleRename = useCallback(
    async (taskId: string, newTitle: string) => {
      setTasks((prev) =>
        prev.map((n) => (n.id === taskId ? { ...n, title: newTitle, name: newTitle } : n))
      );

      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(errBody.error ?? 'Rename failed');
        }
      } catch (err) {
        console.error('[Tree] Rename failed, reverting:', err);
        const original = initialTasks.find((n) => n.id === taskId);
        if (original) {
          setTasks((prev) =>
            prev.map((n) =>
              n.id === taskId ? { ...n, title: original.title, name: original.title } : n
            )
          );
        }
        throw err;
      }
    },
    [initialTasks]
  );

  // ---------------------------------------------------------------------------
  // Shared props for TreeNode
  // ---------------------------------------------------------------------------

  const sharedNodeProps = {
    onToggle: handleToggle,
    onRename: handleRename,
    onAddChild: handleAddChild,
    onDelete: handleDelete,
    editingNodeId,
    onEditingDone: () => setEditingNodeId(null),
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
    onAssigneesChange: handleAssigneesChange,
    priorityPickerOpenForId: priorityPickerTaskId,
    onPriorityPickerOpen: (id: string) => setPriorityPickerTaskId(id),
    onPriorityPickerClose: () => setPriorityPickerTaskId(null),
    onPriorityChange: handlePriorityChange,
    statusPickerOpenForId: statusPickerTaskId,
    onStatusPickerOpen: (id: string) => setStatusPickerTaskId(id),
    onStatusPickerClose: () => setStatusPickerTaskId(null),
    onStatusChange: handleStatusChange,
    dueDatePickerOpenForId: dueDatePickerTaskId,
    onDueDatePickerOpen: (id: string) => setDueDatePickerTaskId(id),
    onDueDatePickerClose: () => setDueDatePickerTaskId(null),
    onDueDateChange: handleDueDateChange,
    labels,
    labelMap,
    labelPickerOpenForId: labelPickerTaskId,
    onLabelPickerOpen: (id: string) => setLabelPickerTaskId(id),
    onLabelPickerClose: () => setLabelPickerTaskId(null),
    onLabelsChange: handleLabelsChange,
    onCreateLabel: handleCreateLabel,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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

          {/* Board header */}
          <div className="flex items-center gap-2 px-3 h-10 mb-3">
            <button
              onClick={onBack}
              className="shrink-0 text-table-secondary hover:text-monday-dark transition-colors"
              title="All boards"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-monday-dark">{board.name}</span>
            <span className="text-xs font-medium text-table-foreground bg-badge-bg rounded-full px-2 py-0.5 leading-none">
              {totalCount}
            </span>
            <div className="flex-1" />
            <button
              onClick={handleAddRoot}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-table-secondary hover:text-foreground hover:bg-badge-bg transition-colors"
              title="Add task"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Plan limit banner */}
          {limitError && (
            <PlanLimitBanner
              error={limitError}
              plan={workspace.plan}
              onDismiss={() => setLimitError(null)}
            />
          )}

          {/* Status groups */}
          {STATUS_GROUPS.map(({ status, label, color }) => {
            const groupKey = status ?? '__null__';
            const rootNodes = groupedTrees.get(status) ?? [];
            const isGroupCollapsed = collapsedIds.has(`__group__${groupKey}`);
            const count = rootNodes.length;

            // Hide empty groups
            if (count === 0) return null;

            return (
              <div key={groupKey} className="rounded-lg overflow-hidden mb-4 bg-surface">
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 h-10 bg-table-header rounded-lg">
                  <button
                    onClick={() => handleToggle(`__group__${groupKey}`)}
                    className="shrink-0 w-5 h-5 flex items-center justify-center text-table-secondary hover:text-monday-dark transition-colors"
                  >
                    <svg
                      width="10" height="10" viewBox="0 0 8 8" fill="currentColor"
                      style={{
                        transform: isGroupCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                        transition: 'transform 120ms ease',
                      }}
                    >
                      <path d="M2 1.5l4 2.5-4 2.5V1.5z" />
                    </svg>
                  </button>

                  <StatusDot color={color} />
                  <span className="text-sm font-semibold text-monday-dark">{label}</span>
                  <span className="text-xs font-medium text-icon-muted bg-badge-bg rounded-full px-2 py-0.5 leading-none">
                    {count}
                  </span>

                  <div className="flex-1" />
                  <button
                    onClick={handleAddRoot}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-table-foreground hover:text-foreground hover:bg-badge-bg transition-colors"
                    title="Add task"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* Group rows */}
                {!isGroupCollapsed && (
                  <>
                    {count === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-icon-muted">
                        <p className="text-sm">No tasks yet.</p>
                      </div>
                    ) : (
                      <div className="my-1">
                        {rootNodes.map((node) => (
                          <TreeNode
                            key={node.id}
                            node={node}
                            {...sharedNodeProps}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

        </SortableContext>

        <DragLayer activeNode={activeNode} />
      </DndContext>

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
              onClick={confirmDelete}
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

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

async function patchTask(payload: PatchTaskPayload): Promise<void> {
  const res = await fetch(`/api/tasks/${payload.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parent_task_id: payload.parent_task_id,
      position: payload.position,
      depth: payload.depth,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'PATCH failed');
  }
}
