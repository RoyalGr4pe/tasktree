import type { Task, DependencyMap } from '@/types';

export const NODE_W = 240;
export const NODE_H = 96;
export const COL_GAP = 120;
export const ROW_GAP = 32;
export const PAD = 32;

export function computeLayout(tasks: Task[], dependencyMap: DependencyMap) {
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

export function edgePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}
