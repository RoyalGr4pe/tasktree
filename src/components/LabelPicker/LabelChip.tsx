'use client';

import type { Label } from './types';

export function LabelChip({ label, onClick }: { label: Label; onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-2 text-sm border-[0.5px] border-table-secondary font-medium px-3 py-0.5 rounded-full transition-opacity hover:opacity-80"
            style={{ color: label.color }}
        >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: label.color }} />
            {label.name}
        </button>
    );
}
