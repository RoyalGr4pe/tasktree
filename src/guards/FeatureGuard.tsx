'use client';

import React, { useEffect, useState } from 'react';
import { PLAN_LIMITS, UPGRADE_URL, getNextPlan, getPlanLabel } from '@/lib/plan-limits';
import type { PlanLimits } from '@/lib/plan-limits';
import type { Plan } from '@/types';
import { getWorkspace } from '@/services/workspaces';

interface Props {
    children: React.ReactNode;
    /** The PlanLimits key to check. Access is blocked when the limit is 0. */
    feature: keyof PlanLimits;
    /** Optional fallback UI. Defaults to a built-in upgrade prompt. */
    fallback?: React.ReactNode;
}

type GuardState = 'loading' | 'allowed' | 'blocked' | 'error';

const FeatureGuard: React.FC<Props> = ({ children, feature, fallback }) => {
    const [state, setState] = useState<GuardState>('loading');
    const [plan, setPlan] = useState<Plan | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function check() {
            try {
                const { getMondayContext } = await import('@/lib/monday-context');
                const ctx = await getMondayContext();

                const workspace = await getWorkspace(ctx.workspaceId);
                if (cancelled) return;

                const limits = PLAN_LIMITS[workspace.plan];
                const limit = limits[feature];
                setPlan(workspace.plan);
                setState(limit > 0 ? 'allowed' : 'blocked');
            } catch {
                if (!cancelled) setState('error');
            }
        }

        check();
        return () => { cancelled = true; };
    }, [feature]);

    if (state === 'loading') return null;
    if (state === 'error') return null;
    if (state === 'allowed') return <>{children}</>;

    if (fallback !== undefined) return <>{fallback}</>;

    const currentPlanLabel = plan ? getPlanLabel(plan) : 'current';
    const nextPlan = plan ? getNextPlan(plan) : 'Pro';

    return (
        <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-monday-error/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-monday-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m0-6v2m0-6v2M5.05 5.05A7 7 0 1118.95 18.95 7 7 0 015.05 5.05z" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-monday-dark">
                    Not available on the {currentPlanLabel} plan
                </p>
                <p className="text-xs text-monday-dark-secondary mt-0.5">
                    Upgrade to {nextPlan} to unlock this feature.
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
};

export default FeatureGuard;
