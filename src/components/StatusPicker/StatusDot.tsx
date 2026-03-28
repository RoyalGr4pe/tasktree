'use client';

export function StatusDot({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="6" fill={color} opacity="0.2" />
      <circle cx="7" cy="7" r="3.5" fill={color} />
    </svg>
  );
}
