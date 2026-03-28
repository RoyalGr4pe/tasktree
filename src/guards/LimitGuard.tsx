'use client';

import React from 'react';
import type { Plan } from '@/types';
import { UPGRADE_URL } from '@/lib/plan-limits';

interface LimitGuardProps {
  /** Current count of the resource (e.g. boards.length) */
  current: number;
  /** Max allowed by the plan. Pass Infinity for unlimited. */
  limit: number;
  plan: Plan;
  /** Label for the resource e.g. "board", "portfolio" */
  resourceLabel: string;
  /** The action button / trigger that creates more of this resource */
  children: React.ReactNode;
  /** Whether to show the usage bar below. Defaults to true. */
  showUsage?: boolean;
  /** Whether to show the at-limit "X/Y used · Upgrade" message. Defaults to true. */
  showAtLimitMessage?: boolean;
}

/**
 * Wraps a create-action (button/trigger) and disables it when the plan limit
 * is reached. Optionally renders a usage progress bar beneath the children.
 *
 * Does NOT fetch anything — pass in already-loaded plan data.
 */
export function LimitGuard({
  current,
  limit,
  plan,
  resourceLabel,
  children,
  showUsage = true,
  showAtLimitMessage = true,
}: LimitGuardProps) {
  const atLimit = current >= limit;
  const isUnlimited = limit === Infinity;

  return (
    <div className="flex flex-col gap-1.5">
      {atLimit && showAtLimitMessage ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-monday-dark-secondary">
            <span className="font-medium text-monday-error">{current}/{limit}</span> {resourceLabel}s used
          </span>
          <a
            href={UPGRADE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-monday-blue bg-monday-blue/10 px-2 py-0.5 rounded-full hover:bg-monday-blue/20 transition-colors"
          >
            Upgrade for more
          </a>
        </div>
      ) : atLimit ? null : (
        children
      )}

      {showUsage && !isUnlimited && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-badge-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-monday-blue rounded-full transition-all"
              style={{ width: `${Math.min(100, (current / limit) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-monday-dark-secondary whitespace-nowrap">
            <span className={atLimit ? 'text-monday-error font-medium' : ''}>{current}</span>
            {' / '}{limit} {resourceLabel}s · <span className="font-medium capitalize">{plan}</span>
          </span>
        </div>
      )}
    </div>
  );
}
