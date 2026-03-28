import { useCallback, useState } from 'react';
import {
  createTask as createTaskRequest,
  patchTask as patchTaskFields,
  patchTaskPosition,
  deleteTask,
  assignUser,
  unassignUser,
  addDependency,
  removeDependency,
} from '@/services/tasks';
import { createLabel, setTaskLabels } from '@/services/labels';
import { renameBoard, deleteBoard } from '@/services/boards';
import { clientDetectCycle } from '@/lib/tree-utils';
import type { Task, Board, Workspace, PlanLimitError, DependencyMap } from '@/types';
import type { Label } from '@/components/LabelPicker';
import type { Priority } from '@/components/PriorityPicker';
import type { Status } from '@/components/StatusPicker';

interface UseTreeActionsParams {
  board: Board;
  workspace: Workspace;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  initialTasks: Task[];
  selectedIds: Set<string>;
  assigneeMap: Record<string, string[]>;
  setAssigneeMap: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setLabels: React.Dispatch<React.SetStateAction<Label[]>>;
  setLabelMap: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  dependencyMap: DependencyMap;
  setDependencyMap: React.Dispatch<React.SetStateAction<DependencyMap>>;
}

export function useTreeActions({
  board,
  workspace,
  tasks,
  setTasks,
  initialTasks,
  selectedIds,
  assigneeMap,
  setAssigneeMap,
  setLabels,
  setLabelMap,
  dependencyMap,
  setDependencyMap,
}: UseTreeActionsParams) {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ nodeId: string; nodeIds: string[]; hasChildren: boolean } | null>(null);
  const [limitError, setLimitError] = useState<PlanLimitError | null>(null);
  const [boardName, setBoardName] = useState(board.name);
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [boardRenameValue, setBoardRenameValue] = useState(board.name);
  const [pendingDeleteBoard, setPendingDeleteBoard] = useState(false);

  // ── Task field patches ──────────────────────────────────────────────────

  const handlePriorityChange = useCallback(async (taskId: string, priority: Priority) => {
    const normalised = priority === 'no_priority' ? null : priority;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, priority: normalised } : t));
    await patchTaskFields(taskId, { priority: normalised })
      .catch((err) => console.error('[Tree] Failed to persist priority:', err));
  }, [setTasks]);

  const handleStatusChange = useCallback(async (taskId: string, status: Status | null) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    await patchTaskFields(taskId, { status })
      .catch((err) => console.error('[Tree] Failed to persist status:', err));
  }, [setTasks]);

  const handleDueDateChange = useCallback(async (taskId: string, due_date: string | null) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, due_date } : t));
    await patchTaskFields(taskId, { due_date })
      .catch((err) => console.error('[Tree] Failed to persist due date:', err));
  }, [setTasks]);

  const handleEstimateChange = useCallback(async (taskId: string, estimate_hours: number | null) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, estimate_hours } : t));
    await patchTaskFields(taskId, { estimate_hours })
      .catch((err) => console.error('[Tree] Failed to persist estimate:', err));
  }, [setTasks]);

  // ── Assignees ──────────────────────────────────────────────────────────

  function handleAssigneesChange(taskId: string, userIds: string[]) {
    setAssigneeMap((prev) => ({ ...prev, [taskId]: userIds }));
  }

  // ── Labels ──────────────────────────────────────────────────────────────

  const handleLabelsChange = useCallback(async (taskId: string, labelIds: string[]) => {
    setLabelMap((prev) => ({ ...prev, [taskId]: labelIds }));
    await setTaskLabels(taskId, board.id, labelIds)
      .catch((err) => console.error('[Tree] Failed to persist labels:', err));
  }, [board.id, setLabelMap]);

  const handleCreateLabel = useCallback(async (name: string, color: string): Promise<Label> => {
    const label = await createLabel(workspace.id, name, color);
    setLabels((prev) => [...prev, label]);
    return label;
  }, [workspace.id, setLabels]);

  // ── Dependencies ───────────────────────────────────────────────────────

  const handleAddDependency = useCallback(async (taskId: string, dependsOnId: string) => {
    if (clientDetectCycle(taskId, dependsOnId, dependencyMap)) return;
    setDependencyMap((prev) => ({
      ...prev,
      [taskId]: [...(prev[taskId] ?? []), dependsOnId],
    }));
    try {
      await addDependency(taskId, dependsOnId);
    } catch {
      setDependencyMap((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).filter((id) => id !== dependsOnId),
      }));
      console.error('[Tree] Failed to add dependency');
    }
  }, [dependencyMap, setDependencyMap]);

  const handleRemoveDependency = useCallback(async (taskId: string, dependsOnId: string) => {
    setDependencyMap((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).filter((id) => id !== dependsOnId),
    }));
    await removeDependency(taskId, dependsOnId)
      .catch((err) => console.error('[Tree] Failed to remove dependency:', err));
  }, [setDependencyMap]);

  // ── Bulk operations ────────────────────────────────────────────────────

  const handleBulkStatusChange = useCallback(async (status: Status | null) => {
    const ids = [...selectedIds].filter((id) => !id.startsWith('__temp__'));
    setTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, status } : t));
    await Promise.all(ids.map((id) =>
      patchTaskFields(id, { status })
        .catch((err) => console.error('[Tree] Failed to bulk patch status:', id, err))
    ));
  }, [selectedIds, setTasks]);

  const handleBulkPriorityChange = useCallback(async (priority: Priority) => {
    const normalised = priority === 'no_priority' ? null : priority;
    const ids = [...selectedIds].filter((id) => !id.startsWith('__temp__'));
    setTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, priority: normalised } : t));
    await Promise.all(ids.map((id) =>
      patchTaskFields(id, { priority: normalised })
        .catch((err) => console.error('[Tree] Failed to bulk patch priority:', id, err))
    ));
  }, [selectedIds, setTasks]);

  const handleBulkLabelsChange = useCallback(async (labelIds: string[]) => {
    const ids = [...selectedIds].filter((id) => !id.startsWith('__temp__'));
    setLabelMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = labelIds; });
      return next;
    });
    await Promise.all(ids.map((id) =>
      setTaskLabels(id, board.id, labelIds)
        .catch((err) => console.error('[Tree] Failed to bulk patch labels:', id, err))
    ));
  }, [selectedIds, board.id, setLabelMap]);

  const handleBulkAssigneesChange = useCallback(async (userIds: string[]) => {
    const ids = [...selectedIds].filter((id) => !id.startsWith('__temp__'));
    setAssigneeMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = userIds; });
      return next;
    });
    await Promise.all(ids.map(async (taskId) => {
      const current = assigneeMap[taskId] ?? [];
      await Promise.all(
        current.filter((uid) => !userIds.includes(uid)).map((uid) =>
          unassignUser(taskId, uid)
            .catch((err) => console.error('[Tree] Failed to bulk unassign:', taskId, uid, err))
        )
      );
      await Promise.all(
        userIds.filter((uid) => !current.includes(uid)).map((uid) =>
          assignUser(taskId, uid, workspace.id)
            .catch((err) => console.error('[Tree] Failed to bulk assign:', taskId, uid, err))
        )
      );
    }));
  }, [selectedIds, assigneeMap, workspace.id, setAssigneeMap]);

  // ── Create task ────────────────────────────────────────────────────────

  async function createTask(parentTaskId: string | null, initialStatus: Status | null = null) {
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
    setEditingNodeId(tempId);

    let newTask: Task;
    try {
      newTask = await createTaskRequest({
        board_id: board.id,
        workspace_id: workspace.id,
        parent_task_id: parentTaskId,
        title: '',
        status: initialStatus,
      });
    } catch (err: unknown) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setEditingNodeId(null);
      const status = (err as { status?: number }).status;
      if (status === 403) {
        const body = (err as { body?: { error?: PlanLimitError } }).body;
        setLimitError(body?.error ?? null);
        return;
      }
      throw err;
    }

    setTasks((prev) => prev.map((t) => t.id === tempId ? newTask : t));
    setEditingNodeId(newTask.id);
  }

  const handleAddRoot = useCallback((status: Status | null = null) => {
    createTask(null, status).catch((err) => console.error('[Tree] Failed to add root task:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, workspace.id]);

  const handleAddChild = useCallback((parentNodeId: string) => {
    createTask(parentNodeId).catch((err) => console.error('[Tree] Failed to add child task:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, workspace.id]);

  // ── Delete ─────────────────────────────────────────────────────────────

  const handleDelete = useCallback((nodeId: string, hasChildren: boolean) => {
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

    try {
      await Promise.all(nodeIds.map((id) => deleteTask(id)));
    } catch (err) {
      console.error('[Tree] Delete failed, restoring tasks:', err);
      setTasks(tasks);
    }
  }, [pendingDelete, tasks, setTasks]);

  // ── Rename ─────────────────────────────────────────────────────────────

  const handleRename = useCallback(async (taskId: string, newTitle: string) => {
    setTasks((prev) =>
      prev.map((n) => (n.id === taskId ? { ...n, title: newTitle, name: newTitle } : n))
    );
    try {
      await patchTaskFields(taskId, { title: newTitle });
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
  }, [initialTasks, setTasks]);

  // ── Board rename / delete ──────────────────────────────────────────────

  const commitBoardRename = useCallback(async (onBoardRenamed: (board: Board) => void) => {
    const trimmed = boardRenameValue.trim();
    setIsRenamingBoard(false);
    if (!trimmed || trimmed === boardName) return;
    setBoardName(trimmed);
    try {
      const updated = await renameBoard(board.id, trimmed);
      onBoardRenamed(updated);
    } catch {
      setBoardName(boardName);
    }
  }, [boardRenameValue, boardName, board.id]);

  const confirmDeleteBoard = useCallback(async (onBoardDeleted: (boardId: string) => void) => {
    setPendingDeleteBoard(false);
    await deleteBoard(board.id);
    onBoardDeleted(board.id);
  }, [board.id]);

  return {
    editingNodeId, setEditingNodeId,
    pendingDelete, setPendingDelete,
    limitError, setLimitError,
    boardName,
    isRenamingBoard, setIsRenamingBoard,
    boardRenameValue, setBoardRenameValue,
    pendingDeleteBoard, setPendingDeleteBoard,
    handlePriorityChange,
    handleStatusChange,
    handleDueDateChange,
    handleEstimateChange,
    handleAssigneesChange,
    handleLabelsChange,
    handleCreateLabel,
    handleAddDependency,
    handleRemoveDependency,
    handleBulkStatusChange,
    handleBulkPriorityChange,
    handleBulkLabelsChange,
    handleBulkAssigneesChange,
    handleAddRoot,
    handleAddChild,
    handleDelete,
    confirmDelete,
    handleRename,
    commitBoardRename,
    confirmDeleteBoard,
  };
}
