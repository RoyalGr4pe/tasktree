import { useEffect, useState } from 'react';
import { getAssignees, getDependencies } from '@/services/tasks';
import { getLabels, getTaskLabels } from '@/services/labels';
import { getUsers } from '@/services/users';
import type { MondayUser, DependencyMap, Board, Workspace } from '@/types';
import type { Label } from '@/components/LabelPicker';

export function useTreeData(board: Board, workspace: Workspace) {
  const [mondayUsers, setMondayUsers] = useState<MondayUser[]>([]);
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string[]>>({});
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelMap, setLabelMap] = useState<Record<string, string[]>>({});
  const [dependencyMap, setDependencyMap] = useState<DependencyMap>({});

  useEffect(() => {
    getUsers()
      .then((users) => setMondayUsers(users))
      .catch((err) => console.error('[Tree] Failed to fetch users:', err));

    getAssignees(board.id)
      .then((assignees) => {
        const map: Record<string, string[]> = {};
        for (const a of assignees) {
          if (!map[a.task_id]) map[a.task_id] = [];
          map[a.task_id].push(a.user_id);
        }
        setAssigneeMap(map);
      })
      .catch((err) => console.error('[Tree] Failed to fetch assignees:', err));

    getLabels(workspace.id)
      .then((l) => setLabels(l))
      .catch((err) => console.error('[Tree] Failed to fetch labels:', err));

    getTaskLabels(board.id)
      .then((taskLabels) => {
        const map: Record<string, string[]> = {};
        for (const tl of taskLabels) {
          if (!map[tl.task_id]) map[tl.task_id] = [];
          map[tl.task_id].push(tl.label_id);
        }
        setLabelMap(map);
      })
      .catch((err) => console.error('[Tree] Failed to fetch task labels:', err));

    getDependencies(board.id)
      .then((dependencies) => {
        const map: DependencyMap = {};
        for (const d of dependencies) {
          if (!map[d.task_id]) map[d.task_id] = [];
          map[d.task_id].push(d.depends_on_task_id);
        }
        setDependencyMap(map);
      })
      .catch((err) => console.error('[Tree] Failed to fetch dependencies:', err));
  }, [board.id, workspace.id]);

  return {
    mondayUsers,
    assigneeMap, setAssigneeMap,
    labels, setLabels,
    labelMap, setLabelMap,
    dependencyMap, setDependencyMap,
  };
}
