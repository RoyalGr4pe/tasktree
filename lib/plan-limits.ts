import type { Plan } from '@/types';

export const UPGRADE_URL = 'https://tasktree.salkaro.com/#pricing';

export interface PlanLimits {
  maxBoards: number;
  maxTasksPerBoard: number;
  maxDepth: number;       // Infinity = unlimited
  maxPrograms: number;    // 0 = feature not available
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxBoards: 1,
    maxTasksPerBoard: 100,
    maxDepth: 3,
    maxPrograms: 1,
  },
  pro: {
    maxBoards: 10,
    maxTasksPerBoard: 2000,
    maxDepth: Infinity,
    maxPrograms: 2,
  },
  business: {
    maxBoards: Infinity,
    maxTasksPerBoard: Infinity,
    maxDepth: Infinity,
    maxPrograms: Infinity,
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
