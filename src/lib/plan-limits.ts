import type { Plan } from '@/types';

export const UPGRADE_URL = 'https://tasktree.salkaro.com/#pricing';

export interface PlanLimits {
  maxBoards: number;
  maxTasksPerBoard: number;
  maxDepth: number;            // Infinity = unlimited
  maxPrograms: number;         // 0 = feature not available
  maxAssigneesPerTask: number; // Infinity = unlimited
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxBoards: 1,
    maxTasksPerBoard: 100,
    maxDepth: 3,
    maxPrograms: 1,
    maxAssigneesPerTask: 1,
  },
  pro: {
    maxBoards: 10,
    maxTasksPerBoard: 2000,
    maxDepth: Infinity,
    maxPrograms: 2,
    maxAssigneesPerTask: Infinity,
  },
  business: {
    maxBoards: Infinity,
    maxTasksPerBoard: Infinity,
    maxDepth: Infinity,
    maxPrograms: Infinity,
    maxAssigneesPerTask: Infinity,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** Returns the next upgrade tier for display purposes. */
export function getNextPlan(plan: Plan): string {
  if (plan === 'free') return 'Pro';
  if (plan === 'pro') return 'Business';
  return 'Business';
}

/** Returns a human-readable capitalised plan label. */
export function getPlanLabel(plan: Plan): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function isBoardLimitReached(plan: Plan, currentBoardCount: number): boolean {
  return currentBoardCount >= PLAN_LIMITS[plan].maxBoards;
}

export function isTaskLimitReached(plan: Plan, currentTaskCount: number): boolean {
  return currentTaskCount >= PLAN_LIMITS[plan].maxTasksPerBoard;
}

export function isDepthLimitReached(plan: Plan, newDepth: number): boolean {
  return newDepth > PLAN_LIMITS[plan].maxDepth;
}
