import type { Plan } from '@/types';

export interface PlanLimits {
  maxBoards: number;
  maxTasksPerBoard: number;
  maxDepth: number;  // Infinity = unlimited
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxBoards: 1,
    maxTasksPerBoard: 100,
    maxDepth: 3,
  },
  pro: {
    maxBoards: 10,
    maxTasksPerBoard: 2000,
    maxDepth: Infinity,
  },
  business: {
    maxBoards: Infinity,
    maxTasksPerBoard: Infinity,
    maxDepth: Infinity,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
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
