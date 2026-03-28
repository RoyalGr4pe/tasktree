'use client';

import React from 'react';
import { UPGRADE_URL } from '@/lib/plan-limits';

interface PlanGateProps {
  /** The numeric plan limit for this feature. 0 = not available on this plan. */
  limit: number;
  /** Content to show when the feature is available */
  children: React.ReactNode;
  /** Optional custom fallback. Defaults to an inline upgrade prompt. */
  fallback?: React.ReactNode;
  /** Label for the feature e.g. "Portfolios". Used in the default fallback. */
  featureLabel?: string;
  /** Plans that unlock this feature e.g. "Pro or Business". Used in the default fallback. */
  requiredPlan?: string;
}

/**
 * Renders children only when the feature is available on the current plan
 * (limit > 0). Shows an upgrade prompt otherwise.
 *
 * Does NOT fetch anything — pass in the limit from already-loaded plan data.
 */
export function PlanGate({
  limit,
  children,
  fallback,
  featureLabel = 'This feature',
  requiredPlan = 'Pro or Business',
}: PlanGateProps) {
  const available = limit > 0;

  if (available) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3">
      <div className="w-8 h-8 rounded-lg bg-badge-bg flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-icon-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-monday-dark">{featureLabel} requires an upgrade</p>
        <p className="text-xs text-monday-dark-secondary mt-0.5">
          Available on the{' '}
          <span className="font-semibold text-monday-blue">{requiredPlan}</span> plan.
        </p>
      </div>
      <a
        href={UPGRADE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-monday-blue rounded-lg hover:bg-monday-blue-hover transition-colors"
      >
        Upgrade →
      </a>
    </div>
  );
}
