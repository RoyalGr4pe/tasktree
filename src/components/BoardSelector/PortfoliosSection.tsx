'use client';

import { useState } from 'react';
import { renameProgram, deleteProgram } from '@/services/programs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Program, Plan } from '@/types';
import type { PlanLimits } from '@/lib/plan-limits';
import { LimitGuard, PlanGate } from '@/guards';
import { ProgramRow } from './ProgramRow';

interface PortfoliosSectionProps {
    programs: Program[];
    limits: PlanLimits;
    plan: Plan;
    onSelectProgram: (program: Program) => void;
    onProgramCreated: (name: string) => void;
    onProgramDeleted: (programId: string) => void;
}

export function PortfoliosSection({
    programs,
    limits,
    plan,
    onSelectProgram,
    onProgramCreated,
    onProgramDeleted,
}: PortfoliosSectionProps) {
    const [showNewProgram, setShowNewProgram] = useState(false);
    const [newProgramName, setNewProgramName] = useState('');
    const [renamingProgramId, setRenamingProgramId] = useState<string | null>(null);
    const [renameProgramValue, setRenameProgramValue] = useState('');
    const [pendingDeleteProgramId, setPendingDeleteProgramId] = useState<string | null>(null);

    async function commitProgramRename(program: Program) {
        const trimmed = renameProgramValue.trim();
        setRenamingProgramId(null);
        if (!trimmed || trimmed === program.name) return;
        const updated = await renameProgram(program.id, trimmed);
        onSelectProgram(updated);
    }

    async function confirmDeleteProgram(programId: string) {
        setPendingDeleteProgramId(null);
        await deleteProgram(programId);
        onProgramDeleted(programId);
    }

    function submitNewProgram() {
        if (!newProgramName.trim()) return;
        onProgramCreated(newProgramName.trim());
        setNewProgramName('');
        setShowNewProgram(false);
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-monday-dark">Portfolios</h2>
                    <span className="text-xs text-monday-dark-secondary">— group boards for a cross-board overview</span>
                </div>
                <PlanGate limit={limits.maxPrograms} featureLabel="Portfolios" requiredPlan="Pro or Business">
                    <LimitGuard
                        current={programs.length}
                        limit={limits.maxPrograms}
                        plan={plan}
                        resourceLabel="portfolio"
                        showUsage={false}
                        showAtLimitMessage={false}
                    >
                        <button
                            onClick={() => setShowNewProgram(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-monday-blue hover:bg-monday-blue/10 rounded-md transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            New portfolio
                        </button>
                    </LimitGuard>
                </PlanGate>
            </div>

            <PlanGate
                limit={limits.maxPrograms}
                featureLabel="Portfolios"
                requiredPlan="Pro or Business"
                fallback={
                    programs.length === 0 ? (
                        <div className="rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-badge-bg/50 hover:bg-badge-bg/50">
                                        <TableHead className="text-xs font-medium text-monday-dark-secondary py-2">Name</TableHead>
                                        <TableHead className="text-xs font-medium text-monday-dark-secondary py-2 text-right">Boards</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={2} className="py-6 text-center">
                                            <div className="flex items-center justify-center gap-2 text-icon-muted">
                                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                <span className="text-sm">Portfolios require</span>
                                                <span className="text-xs font-semibold text-monday-blue bg-monday-blue/10 px-2 py-0.5 rounded-full">Pro or Business</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    ) : null
                }
            >
                <div className="rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-badge-bg/50 hover:bg-badge-bg/50">
                                <TableHead className="text-xs font-medium text-monday-dark-secondary py-2">Name</TableHead>
                                <TableHead className="text-xs font-medium text-monday-dark-secondary py-2 text-right">Boards</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {programs.map((program) => (
                                <ProgramRow
                                    key={program.id}
                                    program={program}
                                    isRenaming={renamingProgramId === program.id}
                                    renameValue={renameProgramValue}
                                    onRenameChange={setRenameProgramValue}
                                    onRenameCommit={() => commitProgramRename(program)}
                                    onRenameCancel={() => setRenamingProgramId(null)}
                                    onRenameStart={() => { setRenameProgramValue(program.name); setRenamingProgramId(program.id); }}
                                    onDeleteRequest={() => setPendingDeleteProgramId(program.id)}
                                    onSelect={() => onSelectProgram(program)}
                                />
                            ))}

                            {showNewProgram && (
                                <TableRow>
                                    <TableCell colSpan={2} className="py-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="Portfolio name…"
                                                value={newProgramName}
                                                onChange={(e) => setNewProgramName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') submitNewProgram();
                                                    if (e.key === 'Escape') { setShowNewProgram(false); setNewProgramName(''); }
                                                }}
                                                className="flex-1 px-2 py-1 text-sm border border-monday-blue rounded-md outline-none bg-surface text-monday-dark"
                                            />
                                            <button
                                                onClick={submitNewProgram}
                                                className="px-3 py-1 text-xs font-medium text-white bg-monday-blue rounded-md hover:bg-monday-blue-hover transition-colors"
                                            >
                                                Create portfolio
                                            </button>
                                            <button
                                                onClick={() => { setShowNewProgram(false); setNewProgramName(''); }}
                                                className="px-2 py-1 text-xs text-icon-muted hover:text-monday-dark transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}

                            {programs.length === 0 && !showNewProgram && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={2} className="py-6 text-center">
                                        <p className="text-xs text-monday-dark-secondary">No portfolios yet. Add one to see all your boards in one view.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {limits.maxPrograms !== Infinity && (
                    <div className="mt-2 px-0.5">
                        <LimitGuard
                            current={programs.length}
                            limit={limits.maxPrograms}
                            plan={plan}
                            resourceLabel="portfolio"
                            showUsage={true}
                        >
                            <span />
                        </LimitGuard>
                    </div>
                )}
            </PlanGate>

            <AlertDialog open={!!pendingDeleteProgramId} onOpenChange={(open) => { if (!open) setPendingDeleteProgramId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{programs.find((p) => p.id === pendingDeleteProgramId)?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this portfolio. Boards inside it will not be affected. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => pendingDeleteProgramId && confirmDeleteProgram(pendingDeleteProgramId)}
                            className="bg-monday-error hover:bg-monday-error/90 text-white"
                        >
                            Delete portfolio
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
