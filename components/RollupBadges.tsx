'use client';

import type { TaskRollup } from '@/types';

interface RollupBadgesProps {
  rollup: TaskRollup;
}

export default function RollupBadges({ rollup }: RollupBadgesProps) {
  const { progress_percent, done_count, child_count } = rollup;

  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress_percent / 100);
  const isDone = progress_percent === 100;

  return (
    <div
      className="relative group/rollup flex items-center justify-center"
      title={`${done_count} of ${child_count} subtasks done`}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
        {/* Track */}
        <circle
          cx="11" cy="11" r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-border-subtle"
        />
        {/* Progress arc */}
        <circle
          cx="11" cy="11" r={radius}
          fill="none"
          stroke={isDone ? 'var(--color-monday-success)' : 'var(--color-monday-blue)'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 11 11)"
          style={{ transition: 'stroke-dashoffset 300ms ease' }}
        />
      </svg>

      {/* Tooltip on hover */}
      <div className="pointer-events-none absolute right-full mr-2 px-2 py-1 rounded-lg bg-monday-dark text-background text-xs font-medium whitespace-nowrap opacity-0 group-hover/rollup:opacity-100 transition-opacity z-50 shadow-lg">
        {progress_percent}% · {done_count}/{child_count}
      </div>
    </div>
  );
}
