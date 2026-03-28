'use client';

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Program } from '@/types';

interface ProgramRowProps {
    program: Program;
    isRenaming: boolean;
    renameValue: string;
    onRenameChange: (value: string) => void;
    onRenameCommit: () => void;
    onRenameCancel: () => void;
    onRenameStart: () => void;
    onDeleteRequest: () => void;
    onSelect: () => void;
}

export function ProgramRow({
    program,
    isRenaming,
    renameValue,
    onRenameChange,
    onRenameCommit,
    onRenameCancel,
    onRenameStart,
    onDeleteRequest,
    onSelect,
}: ProgramRowProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <TableRow
                    onClick={() => !isRenaming && onSelect()}
                    className="cursor-pointer hover:bg-monday-blue/5 group"
                >
                    <TableCell className="py-2.5">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-md bg-monday-blue/10 flex items-center justify-center shrink-0">
                                <svg className="w-3.5 h-3.5 text-monday-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            {isRenaming ? (
                                <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => onRenameChange(e.target.value)}
                                    onBlur={onRenameCommit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') onRenameCommit();
                                        if (e.key === 'Escape') onRenameCancel();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm font-medium text-monday-dark bg-transparent border-b border-monday-blue outline-none"
                                />
                            ) : (
                                <span className="text-sm font-medium text-monday-dark">{program.name}</span>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                        <span className="text-xs text-monday-dark-secondary">
                            {(program.program_boards ?? []).length}
                        </span>
                    </TableCell>
                </TableRow>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">
                <ContextMenuItem
                    className="gap-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); onRenameStart(); }}
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    className="gap-2 text-xs text-monday-error focus:text-monday-error focus:bg-monday-error/10"
                    onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
