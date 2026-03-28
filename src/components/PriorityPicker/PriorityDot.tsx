'use client';

export function PriorityDot({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="3" stroke={color} strokeWidth="2" fill="none" />
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill={color} />
    </svg>
  );
}
