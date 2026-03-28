'use client';

import type { TreeTask } from '@/types';
import type { Status } from '@/components/StatusPicker';
import { StatusDot } from '@/components/StatusPicker';
import TreeNode from './TreeNode/TreeNode';
import type { TreeNodeProps } from './TreeNode/TreeNode';

interface StatusGroupProps {
  status: Status | null;
  label: string;
  color: string;
  rootNodes: TreeTask[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onAddTask: () => void;
  sharedNodeProps: Omit<TreeNodeProps, 'node'>;
}

export default function StatusGroup({
  status,
  label,
  color,
  rootNodes,
  isCollapsed,
  onToggleCollapse,
  onAddTask,
  sharedNodeProps,
}: StatusGroupProps) {
  const count = rootNodes.length;
  if (count === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden mb-4 bg-surface">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 h-10 bg-table-header rounded-lg">
        <button
          onClick={onToggleCollapse}
          className="shrink-0 w-5 h-5 flex items-center justify-center text-table-secondary hover:text-monday-dark transition-colors"
        >
          <svg
            width="10" height="10" viewBox="0 0 8 8" fill="currentColor"
            style={{
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 120ms ease',
            }}
          >
            <path d="M2 1.5l4 2.5-4 2.5V1.5z" />
          </svg>
        </button>

        <StatusDot color={color} />
        <span className="text-sm font-semibold text-monday-dark">{label}</span>
        <span className="text-xs font-medium text-icon-muted bg-badge-bg rounded-full px-2 py-0.5 leading-none">
          {count}
        </span>

        <div className="flex-1" />
        <button
          onClick={onAddTask}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-table-foreground hover:text-foreground hover:bg-badge-bg transition-colors"
          title="Add task"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Group rows */}
      {!isCollapsed && (
        <div className="my-1">
          {rootNodes.map((node) => (
            <TreeNode key={node.id} node={node} {...sharedNodeProps} />
          ))}
        </div>
      )}
    </div>
  );
}
