import { format, isValid, parseISO } from 'date-fns';

export function formatDueDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = parseISO(dateStr);
    if (!isValid(date)) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';

    return format(date, 'MMM d');
}

export function isDueDateOverdue(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const date = parseISO(dateStr);
    if (!isValid(date)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}
