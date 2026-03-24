'use client';

import type { Plan, PlanLimitError } from '@/types';
import { PLAN_LIMITS } from '@/lib/plan-limits';

interface PlanLimitBannerProps {
  error: PlanLimitError;
  plan: Plan;
  onDismiss: () => void;
}

const MESSAGES: Record<PlanLimitError, (plan: Plan) => string> = {
  board_limit_reached: (plan) =>
    `You've reached the ${PLAN_LIMITS[plan].maxBoards}-board limit on the ${plan} plan.`,
  task_limit_reached: (plan) =>
    `You've reached the ${PLAN_LIMITS[plan].maxTasksPerBoard}-task limit on the ${plan} plan.`,
  depth_limit_reached: (plan) =>
    `The ${plan} plan supports a maximum nesting depth of ${PLAN_LIMITS[plan].maxDepth}.`,
  assignee_limit_reached: (plan) =>
    `You've reached the assignee limit on the ${plan} plan.`,
};

export default function PlanLimitBanner({ error, plan, onDismiss }: PlanLimitBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
      <svg className="w-4 h-4 shrink-0 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span className="flex-1">{MESSAGES[error](plan)} Upgrade to unlock more.</span>
      <button
        onClick={onDismiss}
        className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
