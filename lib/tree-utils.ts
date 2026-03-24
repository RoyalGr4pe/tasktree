import type { Task, TreeTask as TreeNode } from '@/types';

// Alias for internal use throughout this file
type Node = Task;

// ---------------------------------------------------------------------------
// buildTree
// Converts a flat array of Node records (from Supabase) into a nested tree.
// Nodes are sorted by `position` at each level.
// Orphaned nodes (whose parent_node_id points to a missing node) are
// promoted to the root level so nothing is ever silently lost.
// ---------------------------------------------------------------------------

export function buildTree(nodes: Node[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();

  // First pass: convert every flat Node into a TreeNode with empty children
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [], isExpanded: true });
  }

  const roots: TreeNode[] = [];

  // Second pass: wire up parent → child relationships
  for (const treeNode of nodeMap.values()) {
    if (treeNode.parent_node_id && nodeMap.has(treeNode.parent_node_id)) {
      nodeMap.get(treeNode.parent_node_id)!.children.push(treeNode);
    } else {
      // No parent (or parent missing) → root
      roots.push(treeNode);
    }
  }

  // Third pass: sort children at every level by position
  const sortByPosition = (arr: TreeNode[]) => {
    arr.sort((a, b) => a.position - b.position);
    for (const node of arr) sortByPosition(node.children);
  };

  sortByPosition(roots);

  return roots;
}

// ---------------------------------------------------------------------------
// flattenTree
// Depth-first pre-order traversal.
// Collapsed nodes (isExpanded === false) still emit the parent but skip
// their subtree, which is what a virtual list renderer needs.
// ---------------------------------------------------------------------------

export function flattenTree(tree: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];

  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.isExpanded !== false && node.children.length > 0) {
        visit(node.children);
      }
    }
  };

  visit(tree);
  return result;
}

// ---------------------------------------------------------------------------
// calculateDepth
// Walks up parent_node_id references to count the depth of any node.
// Returns 0 for root nodes.
// ---------------------------------------------------------------------------

export function calculateDepth(nodeId: string, nodes: Node[]): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let depth = 0;
  let current = nodeMap.get(nodeId);

  while (current?.parent_node_id) {
    depth++;
    current = nodeMap.get(current.parent_node_id);
    // Guard against cycles (shouldn't happen with proper DB constraints)
    if (depth > 100) break;
  }

  return depth;
}

// ---------------------------------------------------------------------------
// reorderNodes
// Called after a drag-and-drop completes. Returns an updated flat array of
// Node objects with corrected parent_node_id, position, and depth.
//
// Strategy:
//   1. Remove the dragged node from its current position in the flat list.
//   2. Insert it at the new position (relative to the target node).
//   3. Reassign positions within the new parent's sibling group.
//   4. Recalculate depths for all affected nodes.
// ---------------------------------------------------------------------------

export interface ReorderResult {
  /** Nodes that changed and need to be PATCHed to the server */
  changed: Array<{ id: string; parent_node_id: string | null; position: number; depth: number }>;
  /** Updated full flat list */
  nodes: Node[];
}

export interface ReorderParams {
  nodes: Node[];
  /** ID of the node being dragged */
  activeId: string;
  /** ID of the node it was dropped onto */
  overId: string;
  /** If true, activeNode becomes a child of overNode; otherwise a sibling */
  dropAsChild: boolean;
}

export function reorderNodes({
  nodes,
  activeId,
  overId,
  dropAsChild,
}: ReorderParams): ReorderResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const active = nodeMap.get(activeId);
  const over = nodeMap.get(overId);

  if (!active || !over || activeId === overId) {
    return { changed: [], nodes };
  }

  const newParentId: string | null = dropAsChild ? overId : over.parent_node_id;

  // Collect siblings under the new parent (excluding the active node itself)
  const siblings = nodes
    .filter((n) => n.parent_node_id === newParentId && n.id !== activeId)
    .sort((a, b) => a.position - b.position);

  // Find the insertion index
  let insertAt: number;
  if (dropAsChild) {
    // Append as last child
    insertAt = siblings.length;
  } else {
    // Insert before the over node in its sibling list
    const overIndex = siblings.findIndex((n) => n.id === overId);
    insertAt = overIndex === -1 ? siblings.length : overIndex;
  }

  // Splice active into the siblings array at the correct position
  siblings.splice(insertAt, 0, active);

  // Update positions for all siblings
  const changed: ReorderResult['changed'] = [];

  siblings.forEach((sibling, idx) => {
    const node = nodeMap.get(sibling.id)!;
    const depthForActive = newParentId
      ? calculateDepth(newParentId, nodes) + 1
      : 0;
    const positionChanged = node.position !== idx;
    const parentChanged = sibling.id === activeId && node.parent_node_id !== newParentId;

    if (positionChanged || parentChanged) {
      node.position = idx;
      if (sibling.id === activeId) {
        node.parent_node_id = newParentId;
        node.depth = depthForActive;
      }
      changed.push({
        id: node.id,
        parent_node_id: node.parent_node_id,
        position: node.position,
        depth: node.depth,
      });
    }
  });

  // Also update stale depth values for descendants of the moved node
  const updateDescendants = (parentId: string, parentDepth: number) => {
    for (const node of nodeMap.values()) {
      if (node.parent_node_id === parentId) {
        const newDepth = parentDepth + 1;
        if (node.depth !== newDepth) {
          node.depth = newDepth;
          changed.push({
            id: node.id,
            parent_node_id: node.parent_node_id,
            position: node.position,
            depth: newDepth,
          });
        }
        updateDescendants(node.id, newDepth);
      }
    }
  };

  const movedNode = nodeMap.get(activeId)!;
  updateDescendants(movedNode.id, movedNode.depth);

  return {
    changed,
    nodes: [...nodeMap.values()],
  };
}

// ---------------------------------------------------------------------------
// toggleExpanded
// Immutably toggle a single node's isExpanded flag in a TreeNode tree.
// ---------------------------------------------------------------------------

export function toggleExpanded(tree: TreeNode[], nodeId: string): TreeNode[] {
  return tree.map((node) => {
    if (node.id === nodeId) {
      return { ...node, isExpanded: !node.isExpanded };
    }
    if (node.children.length > 0) {
      return { ...node, children: toggleExpanded(node.children, nodeId) };
    }
    return node;
  });
}

// ---------------------------------------------------------------------------
// updateNodeName
// Immutably update the `name` field of a node anywhere in the tree.
// ---------------------------------------------------------------------------

export function updateNodeName(tree: TreeNode[], nodeId: string, name: string): TreeNode[] {
  return tree.map((node) => {
    if (node.id === nodeId) {
      return { ...node, name };
    }
    if (node.children.length > 0) {
      return { ...node, children: updateNodeName(node.children, nodeId, name) };
    }
    return node;
  });
}
