import { useMemo, useState } from 'react';
import type { Task } from '@/types';
import { type ActiveFilters, EMPTY_FILTERS } from '../FilterBar/types';

export function useTreeFilters(
  tasks: Task[],
  assigneeMap: Record<string, string[]>,
  labelMap: Record<string, string[]>,
) {
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);

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

    const matchingIds = new Set(tasks.filter(taskMatches).map((t) => t.id));
    const idToTask = new Map(tasks.map((t) => [t.id, t]));

    for (const id of [...matchingIds]) {
      let t = idToTask.get(id);
      while (t?.parent_task_id) {
        matchingIds.add(t.parent_task_id);
        t = idToTask.get(t.parent_task_id);
      }
    }

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

  return { filters, setFilters, filteredTasks };
}
