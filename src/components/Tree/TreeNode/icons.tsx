import { TREE_CONFIG } from '@/config/tree';
import { PRIORITIES } from '@/components/PriorityPicker';
import type { Priority } from '@/components/PriorityPicker';

export function AssigneeCtxIcon() {
    return (
        <svg className="w-4 h-4 shrink-0 text-monday-dark-secondary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" />
        </svg>
    );
}

export function PriorityIcon({ priority }: { priority: Priority }) {
    const color = PRIORITIES.find((p) => p.value === priority)?.color ?? '#c8cad0';
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <rect x="1" y="1" width="14" height="14" rx="3" stroke={color} strokeWidth="2" fill="none" />
            <rect x="4" y="4" width="8" height="8" rx="1.5" fill={color} />
        </svg>
    );
}

export function LabelCtxIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" />
        </svg>
    );
}

export function PencilIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

export function SubitemIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M12 15V3M5 3h14" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l4 4-4 4" />
        </svg>
    );
}

export function DependencyIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="5" cy="12" r="2" fill="currentColor" stroke="none" />
            <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none" />
            <circle cx="19" cy="19" r="2" fill="currentColor" stroke="none" />
            <path strokeLinecap="round" strokeWidth={1.5} d="M7 11.5l10-5M7 12.5l10 5" />
        </svg>
    );
}

export function TrashIcon() {
    return (
        <svg className={`${TREE_CONFIG.iconSize} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline strokeLinecap="round" strokeLinejoin="round" points="3 6 5 6 21 6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
    );
}
