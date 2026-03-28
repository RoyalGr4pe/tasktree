'use client';

import { useMemo, useState } from 'react';
import type { Task, DependencyMap } from '@/types';
import { NodeCard } from './NodeCard';
import { computeLayout, edgePath, NODE_W, NODE_H } from './utils';

interface DependencyGraphProps {
  tasks: Task[];
  dependencyMap: DependencyMap;
  onAddDependency: (taskId: string, dependsOnId: string) => void;
  onRemoveDependency: (taskId: string, dependsOnId: string) => void;
}

export default function DependencyGraph({
  tasks,
  dependencyMap,
  onRemoveDependency,
}: DependencyGraphProps) {
  const [hoveredEdge, setHoveredEdge] = useState<{ from: string; to: string } | null>(null);

  const { nodes, edges, svgW, svgH } = useMemo(
    () => computeLayout(tasks, dependencyMap),
    [tasks, dependencyMap]
  );

  const posById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of nodes) m.set(n.id, { x: n.x, y: n.y });
    return m;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <svg className="w-12 h-12 text-border-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" />
          <path strokeLinecap="round" strokeWidth={1.5} d="M7 11.5l10-5M7 12.5l10 5" />
        </svg>
        <div>
          <p className="text-sm font-medium text-monday-dark">No dependencies yet</p>
          <p className="text-xs text-icon-muted mt-0.5">Right-click a task in tree view to add a dependency</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto px-2 pb-8 pt-2">
      <svg width={svgW} height={svgH} style={{ minWidth: svgW, minHeight: svgH, display: 'block' }}>
        <defs>
          <marker id="dep-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-monday-blue)" />
          </marker>
          <marker id="dep-arrow-hover" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-monday-error)" />
          </marker>
        </defs>

        {edges.map(({ from, to }) => {
          const fromPos = posById.get(from);
          const toPos = posById.get(to);
          if (!fromPos || !toPos) return null;
          const isHovered = hoveredEdge?.from === from && hoveredEdge?.to === to;
          const d = edgePath(fromPos, toPos);
          return (
            <g key={`${from}-${to}`}>
              <path
                d={d}
                fill="none"
                stroke={isHovered ? 'var(--color-monday-error)' : 'var(--color-monday-blue)'}
                strokeWidth={isHovered ? 2.5 : 2}
                strokeOpacity={isHovered ? 1 : 0.7}
                markerEnd={isHovered ? 'url(#dep-arrow-hover)' : 'url(#dep-arrow)'}
                style={{ transition: 'stroke 100ms, stroke-width 100ms, stroke-opacity 100ms' }}
              />
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredEdge({ from, to })}
                onMouseLeave={() => setHoveredEdge(null)}
                onClick={() => onRemoveDependency(to, from)}
              >
                <title>Click to remove dependency</title>
              </path>
            </g>
          );
        })}

        {nodes.map(({ id, task, x, y }) => (
          <foreignObject key={id} x={x} y={y} width={NODE_W} height={NODE_H}>
            <NodeCard task={task} />
          </foreignObject>
        ))}
      </svg>

      {hoveredEdge && (
        <p className="text-xs text-icon-muted mt-3 text-center">
          Click the arrow to remove this dependency
        </p>
      )}
    </div>
  );
}
