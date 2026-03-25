'use client';

import { useMemo, useState } from 'react';
import type { Task, DependencyMap } from '@/types';
import { STATUSES } from '@/components/StatusPicker';

interface DependencyGraphProps {
  tasks: Task[];
  dependencyMap: DependencyMap;
  onAddDependency: (taskId: string, dependsOnId: string) => void;
  onRemoveDependency: (taskId: string, dependsOnId: string) => void;
}

// Layout constants
const NODE_W = 240;
const NODE_H = 96;
const COL_GAP = 120;
const ROW_GAP = 32;
const PAD = 32;

// Status chip colours and labels
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  backlog:     { bg: 'rgba(155,160,170,0.15)', text: '#9ba0aa', label: 'Backlog' },
  todo:        { bg: 'rgba(99,102,241,0.12)',  text: '#6366f1', label: 'To Do' },
  in_progress: { bg: 'rgba(240,196,70,0.15)',  text: '#b88a00', label: 'In Progress' },
  in_review:   { bg: 'rgba(249,115,22,0.12)',  text: '#f97316', label: 'In Review' },
  done:        { bg: 'rgba(0,133,77,0.12)',    text: '#00854d', label: 'Done' },
};

// ---------------------------------------------------------------------------
// Layout: longest-path layering
// ---------------------------------------------------------------------------
function computeLayout(tasks: Task[], dependencyMap: DependencyMap) {
  const involvedIds = new Set<string>();
  for (const [taskId, deps] of Object.entries(dependencyMap)) {
    if (deps.length > 0) {
      involvedIds.add(taskId);
      for (const d of deps) involvedIds.add(d);
    }
  }
  if (involvedIds.size === 0) return { nodes: [], edges: [], svgW: 0, svgH: 0 };

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const ids = [...involvedIds].filter((id) => taskById.has(id));

  const outEdges = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of ids) { outEdges.set(id, []); inDegree.set(id, 0); }

  const edgeList: { from: string; to: string }[] = [];
  for (const [taskId, deps] of Object.entries(dependencyMap)) {
    if (!involvedIds.has(taskId)) continue;
    for (const depId of deps) {
      if (!involvedIds.has(depId)) continue;
      outEdges.get(depId)?.push(taskId);
      inDegree.set(taskId, (inDegree.get(taskId) ?? 0) + 1);
      edgeList.push({ from: depId, to: taskId });
    }
  }

  const layer = new Map<string, number>();
  const roots = ids.filter((id) => (inDegree.get(id) ?? 0) === 0);
  for (const id of roots) layer.set(id, 0);

  const topoQueue = [...roots];
  while (topoQueue.length > 0) {
    const current = topoQueue.shift()!;
    const cl = layer.get(current) ?? 0;
    for (const next of outEdges.get(current) ?? []) {
      const nl = cl + 1;
      if ((layer.get(next) ?? 0) < nl) layer.set(next, nl);
      inDegree.set(next, (inDegree.get(next) ?? 1) - 1);
      if (inDegree.get(next) === 0) topoQueue.push(next);
    }
  }

  const columns = new Map<number, string[]>();
  for (const id of ids) {
    const col = layer.get(id) ?? 0;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const sortedCols = [...columns.keys()].sort((a, b) => a - b);
  for (const col of sortedCols) {
    const colIds = columns.get(col)!;
    const x = PAD + col * (NODE_W + COL_GAP);
    colIds.forEach((id, row) => {
      positions.set(id, { x, y: PAD + row * (NODE_H + ROW_GAP) });
    });
  }

  const totalCols = sortedCols.length;
  const maxRows = Math.max(...[...columns.values()].map((c) => c.length));
  const svgW = PAD * 2 + totalCols * (NODE_W + COL_GAP) - COL_GAP;
  const svgH = PAD * 2 + maxRows * (NODE_H + ROW_GAP) - ROW_GAP;

  const nodes = ids.map((id) => ({ id, task: taskById.get(id)!, ...positions.get(id)! }));
  return { nodes, edges: edgeList, svgW, svgH };
}

// ---------------------------------------------------------------------------
// Bezier edge path
// ---------------------------------------------------------------------------
function edgePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// Node card (HTML inside foreignObject)
// ---------------------------------------------------------------------------
function NodeCard({ task }: { task: Task }) {
  const status = task.status ?? 'backlog';
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.backlog;
  const statusLabel = STATUSES.find((s) => s.value === status)?.label ?? status;
  const isDone = status === 'done';
  const isBlocked = status === 'backlog'; // visual hint only — actual blocked state from tree

  const title = task.title || 'Untitled';
  const truncated = title.length > 28 ? title.slice(0, 28) + '…' : title;

  return (
    <div
      style={{
        width: NODE_W,
        height: NODE_H,
        background: 'var(--color-surface)',
        border: `1.5px solid ${isDone ? 'var(--color-monday-success)' : 'var(--color-border-subtle)'}`,
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 14px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      {/* Top row: status chip + blocked indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            background: style.bg,
            color: style.text,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 999,
          }}
        >
          {statusLabel}
        </span>
        {isBlocked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-monday-dark)',
          lineHeight: 1.3,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          marginTop: 6,
        }}
        title={title}
      >
        {truncated}
      </div>

      {/* Bottom row: due date */}
      {task.due_date && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-icon-muted)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DependencyGraph
// ---------------------------------------------------------------------------
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

        {/* Edges — rendered beneath nodes */}
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
              {/* Wide invisible hit area */}
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

        {/* Nodes */}
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
