export type Priority = 'no_priority' | 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'no_priority', label: 'No priority',  color: '#c8cad0' },
  { value: 'low',         label: 'Low',          color: '#a3afc4' },
  { value: 'medium',      label: 'Medium',       color: '#f0c446' },
  { value: 'high',        label: 'High',         color: '#f07046' },
  { value: 'urgent',      label: 'Urgent',       color: '#e03e3e' },
];
