'use client';

import type { Board, Workspace, Program } from '@/types';
import { PLAN_LIMITS } from '@/lib/plan-limits';
import { BoardsSection } from './BoardsSection';
import { PortfoliosSection } from './PortfoliosSection';

interface BoardSelectorProps {
    workspace: Workspace;
    boards: Board[];
    programs: Program[];
    onSelectBoard: (board: Board) => void;
    onBoardCreated: (board: Board) => void;
    onBoardRenamed: (board: Board) => void;
    onBoardDeleted: (boardId: string) => void;
    onSelectProgram: (program: Program) => void;
    onProgramCreated: (name: string) => void;
    onProgramDeleted: (programId: string) => void;
}

export default function BoardSelector({
    workspace,
    boards,
    programs,
    onSelectBoard,
    onBoardCreated,
    onBoardRenamed,
    onBoardDeleted,
    onSelectProgram,
    onProgramCreated,
    onProgramDeleted,
}: BoardSelectorProps) {
    const limits = PLAN_LIMITS[workspace.plan];

    return (
        <main className="min-h-screen bg-app-bg font-sans text-monday-dark flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-start pt-10 pb-16 px-4">
                <div className="w-full max-w-2xl">
                    <BoardsSection
                        workspace={workspace}
                        boards={boards}
                        limits={limits}
                        onBoardCreated={onBoardCreated}
                        onBoardRenamed={onBoardRenamed}
                        onBoardDeleted={onBoardDeleted}
                        onSelectBoard={onSelectBoard}
                    />
                    <PortfoliosSection
                        programs={programs}
                        limits={limits}
                        plan={workspace.plan}
                        onSelectProgram={onSelectProgram}
                        onProgramCreated={onProgramCreated}
                        onProgramDeleted={onProgramDeleted}
                    />
                </div>
            </div>
        </main>
    );
}
