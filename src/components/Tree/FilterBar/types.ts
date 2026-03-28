import type { Priority } from '@/components/PriorityPicker';

export interface ActiveFilters {
  assigneeIds: string[];
  priorities: Priority[];
  labelIds: string[];
  dueDateRange: 'overdue' | 'today' | 'this_week' | null;
}

export const EMPTY_FILTERS: ActiveFilters = {
  assigneeIds: [],
  priorities: [],
  labelIds: [],
  dueDateRange: null,
};

export function isFilterActive(filters: ActiveFilters) {
  return (
    filters.assigneeIds.length > 0 ||
    filters.priorities.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.dueDateRange !== null
  );
}
