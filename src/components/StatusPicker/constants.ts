export type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: 'in_progress', label: 'In Progress',  color: '#f0c446' },
  { value: 'todo',        label: 'To Do',        color: '#6366f1' },
  { value: 'in_review',   label: 'In Review',    color: '#f97316' },
  { value: 'backlog',     label: 'Backlog',      color: '#9ba0aa' },
  { value: 'done',        label: 'Done',         color: '#22c55e' },
];

// Display order for status groups (in_progress first, done last)
export const STATUS_ORDER: Status[] = ['in_progress', 'todo', 'in_review', 'backlog', 'done'];
