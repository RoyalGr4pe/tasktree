'use client';

import { DragOverlay } from '@dnd-kit/core';
import type { TreeTask } from '@/types';

interface DragLayerProps {
  activeNode: TreeTask | null;
}

export default function DragLayer({ activeNode }: DragLayerProps) {
  if (!activeNode) return null;

  return (
    <DragOverlay dropAnimation={null}>
      <div
        className="
          flex items-center gap-2 px-3 py-2
          bg-white border border-monday-blue
          rounded-md shadow-lg
          text-sm font-medium text-monday-dark
          pointer-events-none select-none
          max-w-[320px] truncate
          opacity-90
        "
        style={{ transform: 'rotate(1.5deg)' }}
      >
        {/* Drag handle icon */}
        <svg
          className="w-3.5 h-3.5 shrink-0 text-monday-dark-secondary"
          fill="currentColor"
          viewBox="0 0 16 16"
        >
          <circle cx="5" cy="4" r="1.2" />
          <circle cx="11" cy="4" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="11" cy="12" r="1.2" />
        </svg>

        <span className="truncate">{activeNode.title}</span>

        {activeNode.children.length > 0 && (
          <span className="shrink-0 ml-1 px-1.5 py-0.5 text-xs rounded-full bg-monday-bg-hover text-monday-dark-secondary">
            {countDescendants(activeNode)}
          </span>
        )}
      </div>
    </DragOverlay>
  );
}

function countDescendants(node: TreeTask): number {
  return node.children.reduce((acc, child) => acc + 1 + countDescendants(child), 0);
}
