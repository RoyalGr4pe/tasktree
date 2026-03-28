'use client';

import type { MondayUser } from '@/types';
import type { Label } from '@/components/LabelPicker';
import type { ActiveFilters } from './FilterBar/types';
import FilterBar from './FilterBar/FilterBar';

type ViewMode = 'tree' | 'graph' | 'workload';

interface BoardHeaderProps {
  boardName: string;
  totalCount: number;
  isRenamingBoard: boolean;
  boardRenameValue: string;
  onBoardRenameValueChange: (v: string) => void;
  onCommitBoardRename: () => void;
  onCancelBoardRename: () => void;
  onStartBoardRename: () => void;
  onBack: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddTask: () => void;
  filters: ActiveFilters;
  onFiltersChange: (f: ActiveFilters) => void;
  mondayUsers: MondayUser[];
  labels: Label[];
}

export default function BoardHeader({
  boardName,
  totalCount,
  isRenamingBoard,
  boardRenameValue,
  onBoardRenameValueChange,
  onCommitBoardRename,
  onCancelBoardRename,
  onStartBoardRename,
  onBack,
  viewMode,
  onViewModeChange,
  onAddTask,
  filters,
  onFiltersChange,
  mondayUsers,
  labels,
}: BoardHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-3 h-10 mb-3">
      <button
        onClick={onBack}
        className="shrink-0 text-table-secondary hover:text-monday-dark transition-colors"
        title="All boards"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {isRenamingBoard ? (
        <input
          autoFocus
          value={boardRenameValue}
          onChange={(e) => onBoardRenameValueChange(e.target.value)}
          onBlur={onCommitBoardRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitBoardRename();
            if (e.key === 'Escape') onCancelBoardRename();
          }}
          className="text-sm font-semibold text-monday-dark bg-transparent border-b border-monday-blue outline-none w-48"
        />
      ) : (
        <span
          className="text-sm font-semibold text-monday-dark cursor-pointer hover:text-monday-blue transition-colors"
          onDoubleClick={onStartBoardRename}
          title="Double-click to rename"
        >
          {boardName}
        </span>
      )}

      <span className="text-xs font-medium text-table-foreground bg-badge-bg rounded-full px-2 py-0.5 leading-none">
        {totalCount}
      </span>

      <div className="flex-1" />

      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        mondayUsers={mondayUsers}
        labels={labels}
      />

      {/* View toggle */}
      <div className="flex items-center rounded-lg bg-badge-bg p-0.5 gap-0.5 shrink-0">
        <button
          onClick={() => onViewModeChange('tree')}
          title="Tree view"
          className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${viewMode === 'tree' ? 'bg-surface text-monday-dark shadow-sm' : 'text-icon-muted hover:text-monday-dark'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange('graph')}
          title="Dependency graph"
          className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${viewMode === 'graph' ? 'bg-surface text-monday-dark shadow-sm' : 'text-icon-muted hover:text-monday-dark'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="2" fill="currentColor" stroke="none" />
            <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none" />
            <circle cx="19" cy="19" r="2" fill="currentColor" stroke="none" />
            <path strokeLinecap="round" strokeWidth={1.5} d="M7 11.5l10-5M7 12.5l10 5" />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange('workload')}
          title="Resource load"
          className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${viewMode === 'workload' ? 'bg-surface text-monday-dark shadow-sm' : 'text-icon-muted hover:text-monday-dark'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
      </div>

      <button
        onClick={onAddTask}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-table-secondary hover:text-foreground hover:bg-badge-bg transition-colors"
        title="Add task"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
