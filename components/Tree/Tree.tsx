'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
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
import type { TreeTask, Task, TaskRollup, TaskDependency, DependencyMap, PatchTaskPayload, Board, Workspace, PlanLimitError, MondayUser, TaskAssignee } from '@/types';
import type { Label } from '@/components/LabelPicker';
import type { Priority } from '@/components/PriorityPicker';
import type { Status } from '@/components/StatusPicker';
import { StatusDot } from '@/components/StatusPicker';
import { buildTree, flattenTree, reorderNodes, computeRollups, isTaskBlocked, clientDetectCycle } from '@/lib/tree-utils';
import TreeNode from './TreeNode';
import DragLayer from './DragLayer';
import FilterBar, { EMPTY_FILTERS, type ActiveFilters } from './FilterBar';
import DependencyGraph from '@/components/DependencyGraph';
import WorkloadView from '@/components/WorkloadView';
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
  onBoardRenamed: (board: Board) => void;
  onBoardDeleted: (boardId: string) => void;
  onTaskCountChanged?: (boardId: string, count: number) => void;
}

// Status groups in display order. null status tasks are treated as 'backlog'.
const STATUS_GROUPS: Array<{ status: Status | null; label: string; color: string }> = [
  { status: 'backlog',     label: 'Backlog',      color: '#9ba0aa' },
  { status: 'todo',        label: 'To Do',        color: '#6366f1' },
  { status: 'in_progress', label: 'In Progress',  color: '#f0c446' },
  { status: 'in_review',   label: 'In Review',    color: '#f97316' },
  { status: 'done',        label: 'Done',         color: '#22c55e' },
];

export default function Tree({ initialTasks, board, workspace, onBack, onBoardRenamed, onBoardDeleted, onTaskCountChanged }: TreeProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  useEffect(() => {
    onTaskCountChanged?.(board.id, tasks.length);
  }, [tasks.length, board.id]);

  const [activeNode, setActiveNode] = useState<TreeTask | null>(null);
  const [overNodeId, setOverNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ nodeId: string; nodeIds: string[]; hasChildren: boolean } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [limitError, setLimitError] = useState<PlanLimitError | null>(null);
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);

  // Board rename/delete
  const [boardName, setBoardName] = useState(board.name);
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [boardRenameValue, setBoardRenameValue] = useState(board.name);
  const [pendingDeleteBoard, setPendingDeleteBoard] = useState(false);

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

  // Dependencies: map of taskId → taskIds it depends on
  const [dependencyMap, setDependencyMap] = useState<DependencyMap>({});
  // View mode: tree list, dependency graph, or workload
  const [viewMode, setViewMode] = useState<'tree' | 'graph' | 'workload'>('tree');

  // Fetch monday users + all assignees + labels on mount
  useEffect(() => {
    apiFetch('/api/users')
      .then((r) => r.json())
      .then(({ users }) => setMondayUsers(users ?? []))
      .catch((err) => console.error('[Tree] Failed to fetch users:', err));

    apiFetch(`/api/tasks/assignees?board_id=${board.id}`)
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

    apiFetch(`/api/labels?workspace_id=${workspace.id}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) { console.error('[Tree] Labels API error:', r.status, body); return; }
setLabels(body.labels ?? []);
      })
      .catch((err) => console.error('[Tree] Failed to fetch labels:', err));

    apiFetch(`/api/task-labels?board_id=${board.id}`)
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

    apiFetch(`/api/tasks/dependencies?board_id=${board.id}`)
      .then((r) => r.json())
      .then(({ dependencies }: { dependencies: TaskDependency[] }) => {
        const map: DependencyMap = {};
        for (const d of dependencies ?? []) {
          if (!map[d.task_id]) map[d.task_id] = [];
          map[d.task_id].push(d.depends_on_task_id);
        }
        setDependencyMap(map);
      })
      .catch((err) => console.error('[Tree] Failed to fetch dependencies:', err));
  }, [board.id, workspace.id]);

  const handleLabelsChange = useCallback(async (taskId: string, labelIds: string[]) => {
    setLabelMap((prev) => ({ ...prev, [taskId]: labelIds }));
    await apiFetch('/api/task-labels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, board_id: board.id, label_ids: labelIds }),
    }).catch((err) => console.error('[Tree] Failed to persist labels:', err));
  }, [board.id]);

  const handleCreateLabel = useCallback(async (name: string, color: string): Promise<Label> => {
    const res = await apiFetch('/api/labels', {
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
    await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: normalised }),
    }).catch((err) => console.error('[Tree] Failed to persist priority:', err));
  }, []);

  const handleStatusChange = useCallback(async (taskId: string, status: Status | null) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch((err) => console.error('[Tree] Failed to persist status:', err));
  }, []);

  const handleDueDateChange = useCallback(async (taskId: string, due_date: string | null) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, due_date } : t));
    await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ due_date }),
    }).catch((err) => console.error('[Tree] Failed to persist due date:', err));
  }, []);

  const handleAddDependency = useCallback(async (taskId: string, dependsOnId: string) => {
    if (clientDetectCycle(taskId, dependsOnId, dependencyMap)) return;
    setDependencyMap((prev) => ({
      ...prev,
      [taskId]: [...(prev[taskId] ?? []), dependsOnId],
    }));
    const res = await apiFetch(`/api/tasks/${taskId}/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_task_id: dependsOnId }),
    });
    if (!res.ok) {
      // Revert
      setDependencyMap((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).filter((id) => id !== dependsOnId),
      }));
      console.error('[Tree] Failed to add dependency');
    }
  }, [dependencyMap]);

  const handleRemoveDependency = useCallback(async (taskId: string, dependsOnId: string) => {
    setDependencyMap((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).filter((id) => id !== dependsOnId),
    }));
    await apiFetch(`/api/tasks/${taskId}/dependencies?depends_on_task_id=${dependsOnId}`, {
      method: 'DELETE',
    }).catch((err) => console.error('[Tree] Failed to remove dependency:', err));
  }, []);

  const handleEstimateChange = useCallback(async (taskId: string, estimate_hours: number | null) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, estimate_hours } : t));
    await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimate_hours }),
    }).catch((err) => console.error('[Tree] Failed to persist estimate:', err));
  }, []);

  const handleBulkStatusChange = useCallback(async (status: Status | null) => {
    const ids = [...selectedIds].filter((id) => !id.startsWith('__temp__'));
    setTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, status } : t));
    await Promise.all(ids.map((id) =>
      apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch((err) => console.error('[Tree] Failed to bulk patch status:', id, err))
    ));
  }, [selectedIds]);

  const handleBulkPriorityChange = useCallback(async (priority: Priority) => {
    const normalised = priority === 'no_priority' ? null : priority;
    const ids = [...selectedIds].filter((id) => !id.startsWith('__temp__'));
    setTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, priority: normalised } : t));
    await Promise.all(ids.map((id) =>
      apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: normalised }),
      }).catch((err) => console.error('[Tree] Failed to bulk patch priority:', id, err))
    ));
  }, [selectedIds]);

  const handleBulkLabelsChange = useCallback(async (labelIds: string[]) => {
    const ids = [...selectedIds].filter((id) => !id.startsWith('__temp__'));
    setLabelMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = labelIds; });
      return next;
    });
    await Promise.all(ids.map((id) =>
      apiFetch('/api/task-labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: id, board_id: board.id, label_ids: labelIds }),
      }).catch((err) => console.error('[Tree] Failed to bulk patch labels:', id, err))
    ));
  }, [selectedIds, board.id]);

  const handleBulkAssigneesChange = useCallback(async (userIds: string[]) => {
    const ids = [...selectedIds].filter((id) => !id.startsWith('__temp__'));
    setAssigneeMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = userIds; });
      return next;
    });
    // For assignees, use the existing per-task assign endpoint for each selected task
    // We unassign all then reassign — simplest approach:
    await Promise.all(ids.map(async (taskId) => {
      const current = assigneeMap[taskId] ?? [];
      // Remove users not in new list
      await Promise.all(
        current.filter((uid) => !userIds.includes(uid)).map((uid) =>
          apiFetch(`/api/tasks/${taskId}/assign/${uid}`, { method: 'DELETE' })
            .catch((err) => console.error('[Tree] Failed to bulk unassign:', taskId, uid, err))
        )
      );
      // Add users not already assigned
      await Promise.all(
        userIds.filter((uid) => !current.includes(uid)).map((uid) =>
          apiFetch(`/api/tasks/${taskId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, workspaceId: workspace.id }),
          }).catch((err) => console.error('[Tree] Failed to bulk assign:', taskId, uid, err))
        )
      );
    }));
  }, [selectedIds, assigneeMap, workspace.id]);

  // ---------------------------------------------------------------------------
  // Derived tree data — grouped by root task status
  // ---------------------------------------------------------------------------

  // Apply filters — keep a task if it matches, and always keep its ancestors/descendants
  const filteredTasks = useMemo(() => {
    const { assigneeIds, priorities, labelIds, dueDateRange } = filters;
    const hasFilters = assigneeIds.length > 0 || priorities.length > 0 || labelIds.length > 0 || dueDateRange !== null;
    if (!hasFilters) return tasks;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

    function taskMatches(t: Task): boolean {
      if (assigneeIds.length > 0) {
        const taskAssignees = assigneeMap[t.id] ?? [];
        if (!assigneeIds.some((id) => taskAssignees.includes(id))) return false;
      }
      if (priorities.length > 0) {
        const p = t.priority ?? 'no_priority';
        if (!priorities.includes(p as typeof priorities[number])) return false;
      }
      if (labelIds.length > 0) {
        const taskLabels = labelMap[t.id] ?? [];
        if (!labelIds.some((id) => taskLabels.includes(id))) return false;
      }
      if (dueDateRange !== null) {
        if (!t.due_date) return false;
        const due = new Date(t.due_date); due.setHours(0, 0, 0, 0);
        if (dueDateRange === 'overdue' && due >= today) return false;
        if (dueDateRange === 'today' && due.getTime() !== today.getTime()) return false;
        if (dueDateRange === 'this_week' && (due < today || due > weekEnd)) return false;
      }
      return true;
    }

    // Collect matching IDs, then expand to include all ancestors and descendants
    const matchingIds = new Set(tasks.filter(taskMatches).map((t) => t.id));

    // Add all ancestors of matching tasks
    const idToTask = new Map(tasks.map((t) => [t.id, t]));
    for (const id of [...matchingIds]) {
      let t = idToTask.get(id);
      while (t?.parent_task_id) {
        matchingIds.add(t.parent_task_id);
        t = idToTask.get(t.parent_task_id);
      }
    }

    // Add all descendants of matching tasks
    function addDescendants(id: string) {
      for (const t of tasks) {
        if (t.parent_task_id === id && !matchingIds.has(t.id)) {
          matchingIds.add(t.id);
          addDescendants(t.id);
        }
      }
    }
    for (const id of [...matchingIds]) addDescendants(id);

    return tasks.filter((t) => matchingIds.has(t.id));
  }, [tasks, filters, assigneeMap, labelMap]);

  /**
   * Build the full tree and group ROOT tasks by their status.
   * Subtasks always travel with their root ancestor's group.
   */
  const groupedTrees = useMemo(() => {
    const raw = buildTree(filteredTasks);

    const applyCollapse = (arr: TreeTask[]): TreeTask[] =>
      arr.map((n) => ({
        ...n,
        isExpanded: !collapsedIds.has(n.id),
        children: applyCollapse(n.children),
      }));

    const withExpand = applyCollapse(raw);

    // Group root tasks by their own status (null → 'backlog')
    const groups = new Map<Status | null, TreeTask[]>();
    for (const statusGroup of STATUS_GROUPS) {
      groups.set(statusGroup.status, []);
    }
    for (const rootNode of withExpand) {
      const s = (rootNode.status ?? 'backlog') as Status;
      if (!groups.has(s)) groups.set(s, []);
      groups.get(s)!.push(rootNode);
    }
    return groups;
  }, [filteredTasks, collapsedIds]);

  // Flat list per group (for DnD sortable IDs)
  const flatListByGroup = useMemo(() => {
    const result = new Map<Status | null, TreeTask[]>();
    for (const [status, roots] of groupedTrees) {
      result.set(status, flattenTree(roots));
    }
    return result;
  }, [groupedTrees]);

  // Rollups — recomputed whenever tasks change
  const rollupMap = useMemo<Map<string, TaskRollup>>(() => computeRollups(tasks), [tasks]);

  // Blocked task IDs — tasks with at least one unfinished dependency
  const blockedIds = useMemo<Set<string>>(() => {
    const result = new Set<string>();
    for (const taskId of Object.keys(dependencyMap)) {
      if (isTaskBlocked(taskId, tasks, dependencyMap)) result.add(taskId);
    }
    return result;
  }, [tasks, dependencyMap]);

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

  async function createTask(parentTaskId: string | null, initialStatus: Status | null = null) {
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
      status: initialStatus,
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

    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: board.id,
        workspace_id: workspace.id,
        parent_task_id: parentTaskId,
        title: '',
        status: initialStatus,
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

  const handleAddRoot = useCallback((status: Status | null = null) => {
    createTask(null, status).catch((err) => console.error('[Tree] Failed to add root task:', err));
  }, [board.id, workspace.id]);

  const handleAddChild = useCallback((parentNodeId: string) => {
    createTask(parentNodeId).catch((err) => console.error('[Tree] Failed to add child task:', err));
  }, [board.id, workspace.id]);

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback((nodeId: string, hasChildren: boolean) => {
    // If the right-clicked node is part of the selection, delete all selected; otherwise just this one
    const nodeIds = selectedIds.has(nodeId) ? [...selectedIds] : [nodeId];
    const anyHasChildren = nodeIds.some((id) => tasks.some((t) => t.parent_task_id === id));
    setPendingDelete({ nodeId, nodeIds, hasChildren: hasChildren || anyHasChildren });
  }, [selectedIds, tasks]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const { nodeIds } = pendingDelete;
    setPendingDelete(null);

    const collectIds = (id: string): string[] => {
      const children = tasks.filter((n) => n.parent_task_id === id);
      return [id, ...children.flatMap((c) => collectIds(c.id))];
    };
    const idsToRemove = new Set(nodeIds.flatMap((id: string) => collectIds(id)));

    setTasks((prev) => prev.filter((n) => !idsToRemove.has(n.id)));
    setSelectedIds(new Set());

    try {
      await Promise.all(
        nodeIds.map(async (id) => {
          const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error ?? 'Delete failed');
          }
        })
      );
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
        const res = await apiFetch(`/api/tasks/${taskId}`, {
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
  // Board rename / delete
  // ---------------------------------------------------------------------------

  const commitBoardRename = useCallback(async () => {
    const trimmed = boardRenameValue.trim();
    setIsRenamingBoard(false);
    if (!trimmed || trimmed === boardName) return;
    setBoardName(trimmed);
    const res = await apiFetch(`/api/boards/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      const { board: updated } = await res.json();
      onBoardRenamed(updated);
    } else {
      setBoardName(boardName); // revert
    }
  }, [boardRenameValue, boardName, board.id, onBoardRenamed]);

  const confirmDeleteBoard = useCallback(async () => {
    setPendingDeleteBoard(false);
    await apiFetch(`/api/boards/${board.id}`, { method: 'DELETE' });
    onBoardDeleted(board.id);
  }, [board.id, onBoardDeleted]);

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
    onBulkStatusChange: handleBulkStatusChange,
    onBulkPriorityChange: handleBulkPriorityChange,
    onBulkLabelsChange: handleBulkLabelsChange,
    onBulkAssigneesChange: handleBulkAssigneesChange,
    rollupMap,
    onEstimateChange: handleEstimateChange,
    dependencyMap,
    blockedIds,
    allTasksFlat: tasks.map((t) => ({ id: t.id, title: t.title })),
    onAddDependency: handleAddDependency,
    onRemoveDependency: handleRemoveDependency,
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

            {isRenamingBoard ? (
              <input
                autoFocus
                value={boardRenameValue}
                onChange={(e) => setBoardRenameValue(e.target.value)}
                onBlur={commitBoardRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitBoardRename();
                  if (e.key === 'Escape') { setIsRenamingBoard(false); setBoardRenameValue(boardName); }
                }}
                className="text-sm font-semibold text-monday-dark bg-transparent border-b border-monday-blue outline-none w-48"
              />
            ) : (
              <span
                className="text-sm font-semibold text-monday-dark cursor-pointer hover:text-monday-blue transition-colors"
                onDoubleClick={() => { setBoardRenameValue(boardName); setIsRenamingBoard(true); }}
                title="Double-click to rename"
              >
                {boardName}
              </span>
            )}

            <span className="text-xs font-medium text-table-foreground bg-badge-bg rounded-full px-2 py-0.5 leading-none">
              {totalCount}
            </span>
            <div className="flex-1" />
            <FilterBar
              filters={filters}
              onChange={setFilters}
              mondayUsers={mondayUsers}
              labels={labels}
            />

            {/* View toggle: tree / graph */}
            <div className="flex items-center rounded-lg bg-badge-bg p-0.5 gap-0.5 shrink-0">
              <button
                onClick={() => setViewMode('tree')}
                title="Tree view"
                className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${viewMode === 'tree' ? 'bg-surface text-monday-dark shadow-sm' : 'text-icon-muted hover:text-monday-dark'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('graph')}
                title="Dependency graph"
                className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${viewMode === 'graph' ? 'bg-surface text-monday-dark shadow-sm' : 'text-icon-muted hover:text-monday-dark'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="2" fill="currentColor" stroke="none" />
                  <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none" />
                  <circle cx="19" cy="19" r="2" fill="currentColor" stroke="none" />
                  <path strokeLinecap="round" strokeWidth={1.5} d="M7 11.5l10-5M7 12.5l10 5" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('workload')}
                title="Resource load"
                className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${viewMode === 'workload' ? 'bg-surface text-monday-dark shadow-sm' : 'text-icon-muted hover:text-monday-dark'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => handleAddRoot(null)}
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

          {/* Graph view */}
          {viewMode === 'graph' && (
            <DependencyGraph
              tasks={tasks}
              dependencyMap={dependencyMap}
              onAddDependency={handleAddDependency}
              onRemoveDependency={handleRemoveDependency}
            />
          )}

          {/* Workload view */}
          {viewMode === 'workload' && (
            <WorkloadView
              tasks={tasks}
              assigneeMap={assigneeMap}
              mondayUsers={mondayUsers}
            />
          )}

          {/* Status groups */}
          {/* Empty states */}
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
                onClick={() => handleAddRoot(null)}
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
                    onClick={() => handleAddRoot(status)}
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
              onClick={confirmDeleteBoard}
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
  const res = await apiFetch(`/api/tasks/${payload.id}`, {
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
