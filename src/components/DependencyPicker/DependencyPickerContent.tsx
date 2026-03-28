'use client';

import { useEffect, useRef, useState } from 'react';
import { clientDetectCycle } from '@/lib/tree-utils';
import type { DependencyMap } from '@/types';

interface ContentProps {
  taskId: string;
  allTasksFlat: { id: string; title: string }[];
  dependencyMap: DependencyMap;
  onAddDependency: (taskId: string, dependsOnId: string) => void;
  onRemoveDependency: (taskId: string, dependsOnId: string) => void;
  onClose: () => void;
}

export function DependencyPickerContent({
  taskId,
  allTasksFlat,
  dependencyMap,
  onAddDependency,
  onRemoveDependency,
  onClose,
}: ContentProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // onClose is kept for the portal wrapper
  void onClose;

  const currentDepIds = dependencyMap[taskId] ?? [];

  const candidates = allTasksFlat.filter(
    (t) =>
      t.id !== taskId &&
      (t.title || 'Untitled').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [
    ...candidates.filter((t) => currentDepIds.includes(t.id)),
    ...candidates.filter((t) => !currentDepIds.includes(t.id)),
  ];

  return (
    <>
      <div className="px-3 pt-2 pb-2 border-b border-border-subtle">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm text-monday-dark placeholder:text-monday-dark bg-transparent outline-none border-none"
        />
      </div>

      <ul className="max-h-56 overflow-y-auto p-1">
        {sorted.length === 0 && (
          <li className="px-3 py-2 text-sm text-icon-muted text-center">No tasks found</li>
        )}
        {sorted.map((t, i) => {
          const isAdded = currentDepIds.includes(t.id);
          const wouldCycle = !isAdded && clientDetectCycle(taskId, t.id, dependencyMap);
          const showSeparator = i > 0 && !isAdded && currentDepIds.includes(sorted[i - 1].id);
          return (
            <li key={t.id}>
              {showSeparator && <div className="mx-3 my-1 border-t border-border-subtle" />}
              <button
                onClick={() => {
                  if (wouldCycle) return;
                  if (isAdded) {
                    onRemoveDependency(taskId, t.id);
                  } else {
                    onAddDependency(taskId, t.id);
                  }
                }}
                disabled={wouldCycle}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-node-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
                title={wouldCycle ? 'Would create a circular dependency' : undefined}
              >
                <span className="flex-1 text-sm text-monday-dark text-left truncate font-medium">
                  {t.title || <span className="italic text-icon-muted">Untitled</span>}
                </span>
                {wouldCycle && (
                  <span className="text-xs text-icon-muted shrink-0">circular</span>
                )}
                {isAdded && (
                  <svg className="w-4 h-4 text-monday-dark shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
