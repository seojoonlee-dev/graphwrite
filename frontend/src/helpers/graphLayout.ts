import { type Node, type Edge, Position } from '@xyflow/react';

// Synthetic root every top-level note hangs off, so the graph is one tree.
// Not a real path — handlers treat it as the top level ('').
export const GRAPH_ROOT_ID = '__notes_root__';

// Nodes render as small dots with their labels outside, so layout only needs the
// dot's centre; X_SEP carries the horizontal room for the side labels.
const NODE_WIDTH = 12;
const NODE_HEIGHT = 12;

// Layered tidy-tree spacing: horizontal distance between depths, and the vertical
// distance between adjacent leaf rows.
const X_SEP = 160;
const Y_SEP = 24;

export function getLayoutedElements(files: string[]) {
  const nodesMap = new Map<string, Node>();
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  files.forEach((fullPath) => {
    const noExtPath = fullPath.replace(/\.[^/.]+$/, '');
    const parts = noExtPath.split('/');

    if (parts.length > 1 && parts[parts.length - 1] === parts[parts.length - 2]) {
      parts.pop(); 
    }

    let currentPath = '';

    parts.forEach((part, index) => {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      const isFinalNode = index === parts.length - 1;

      if (!nodesMap.has(currentPath)) {
        nodesMap.set(currentPath, {
          id: currentPath,
          data: {
            label: `${part}`,
            filePath: isFinalNode ? fullPath : undefined,
            isRoot: index === 0,
          },
          position: { x: 0, y: 0 },
          type: 'fileNode',
          className: 'graph-node',
        });
      } else if (isFinalNode) {
        nodesMap.get(currentPath)!.data.filePath = fullPath;
      }

      if (index > 0) {
        const edgeId = `edge-${parentPath}-${currentPath}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: parentPath,
            target: currentPath,
            type: 'bezier',
            // Only the parent (source) end is draggable: detach from the old
            // parent and drop on a new one to re-parent the child.
            reconnectable: 'source',
            // Wide invisible hit area so the thin edge is easy to right-click (cut).
            interactionWidth: 40,
            className: 'graph-edge',
          });
        }
      }
    });
  });

  const nodes = Array.from(nodesMap.values());

  // Anchor every top-level note under one synthetic "Notes" root.
  const topLevel = nodes.filter((node) => !node.id.includes('/'));
  if (topLevel.length > 0) {
    nodes.unshift({
      id: GRAPH_ROOT_ID,
      data: { label: 'Notes', isSynthetic: true },
      position: { x: 0, y: 0 },
      type: 'fileNode',
      className: 'graph-node graph-node-root',
    });
    topLevel.forEach((node) => {
      edges.push({
        id: `edge-${GRAPH_ROOT_ID}-${node.id}`,
        source: GRAPH_ROOT_ID,
        target: node.id,
        type: 'bezier',
        reconnectable: 'source',
        interactionWidth: 40,
        className: 'graph-edge',
      });
    });
  }

  // Build the child lists from the edges, then sort each node's children
  // alphabetically so the tree is tidy and deterministic (readdir order isn't),
  // matching how a file-tree is presented.
  const childrenOf = new Map<string, string[]>();
  edges.forEach((edge) => {
    (childrenOf.get(edge.source) ?? childrenOf.set(edge.source, []).get(edge.source)!).push(edge.target);
  });

  // Mark branch nodes so each can place its label on the correct side of the dot.
  nodes.forEach((node) => {
    node.data.hasChildren = childrenOf.has(node.id);
  });

  const labelOf = (id: string) => String(nodesMap.get(id)?.data.label ?? id);
  childrenOf.forEach((kids) => kids.sort((a, b) => labelOf(a).localeCompare(labelOf(b))));

  // Layered tidy-tree layout (Reingold–Tilford style). The data is a strict tree
  // — every node reaches the synthetic root through exactly one parent — so we
  // place it directly: x by depth, and y by packing leaves top-to-bottom while
  // centring each branch on its outermost children. Unlike a force-directed layout
  // this can't open gaps between siblings: every leaf takes the next row, and a
  // parent always sits at the midpoint of its first and last child.
  const positions = new Map<string, { x: number; y: number }>();
  let nextLeafY = 0;

  const place = (id: string, depth: number, seen: Set<string>): number => {
    seen.add(id);
    const kids = (childrenOf.get(id) ?? []).filter((k) => !seen.has(k));
    const x = depth * X_SEP;
    let y: number;
    if (kids.length === 0) {
      y = nextLeafY;
      nextLeafY += Y_SEP;
    } else {
      const first = place(kids[0], depth + 1, seen);
      let last = first;
      for (let i = 1; i < kids.length; i++) last = place(kids[i], depth + 1, seen);
      y = (first + last) / 2;
    }
    positions.set(id, { x, y });
    return y;
  };

  if (nodes.some((node) => node.id === GRAPH_ROOT_ID)) {
    place(GRAPH_ROOT_ID, 0, new Set());
  }

  const layoutedNodes: Node[] = nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 };
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}