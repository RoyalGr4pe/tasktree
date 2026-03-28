'use client';

export function LabelDot({ color }: { color: string }) {
    return (
        <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: color }}
        />
    );
}
