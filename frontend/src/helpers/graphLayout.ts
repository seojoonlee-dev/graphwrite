import { type Node, type Edge, Position } from '@xyflow/react';
import dagre from 'dagre';

// Synthetic root every top-level note hangs off, so the graph is one tree.
// Not a real path — handlers treat it as the top level ('').
export const GRAPH_ROOT_ID = '__notes_root__';

// Nodes render as small dots with their labels outside, so layout only needs to
// reserve the dot's footprint; ranksep carries the horizontal room for labels.
const NODE_WIDTH = 12;
const NODE_HEIGHT = 12;

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

  // Mark branch nodes so each can place its label on the correct side of the dot;
  // leaves get a class so they render as a filled (accent) dot.
  const parents = new Set(edges.map((edge) => edge.source));
  nodes.forEach((node) => {
    const hasChildren = parents.has(node.id);
    node.data.hasChildren = hasChildren;
    if (!hasChildren) {
      node.className = `${node.className ?? ''} graph-node-leaf`.trim();
    }
  });

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Tight vertical packing (nodesep) with wide columns (ranksep) so side labels
  // have room — mirrors a file-tree graph layout.
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 12, ranksep: 120 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // dagre packs everything with one uniform gap. To separate the subtrees that
  // hang off the Notes root, group each node by which first-level child it
  // descends from and stack those groups with extra space, shifting whole
  // subtrees rigidly so their internal alignment is untouched.
  const parentOf = new Map<string, string>();
  edges.forEach((edge) => parentOf.set(edge.target, edge.source));
  const subtreeOf = (id: string) => {
    let current = id;
    const seen = new Set<string>();
    while (parentOf.has(current) && parentOf.get(current) !== GRAPH_ROOT_ID && !seen.has(current)) {
      seen.add(current);
      current = parentOf.get(current)!;
    }
    return current; // the first-level node (direct child of Notes) for this branch
  };

  const groups = new Map<string, string[]>();
  nodes.forEach((node) => {
    if (node.id === GRAPH_ROOT_ID) return; // the root is centred separately below
    const key = subtreeOf(node.id);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(node.id);
  });

  const GROUP_GAP = 30; // extra vertical space between subtrees
  const yShift = new Map<string, number>();
  let cursor = -Infinity;
  [...groups.keys()]
    // keep dagre's overall ordering by sorting groups on their current top edge
    .sort((a, b) => Math.min(...groups.get(a)!.map((id) => dagreGraph.node(id).y))
                  - Math.min(...groups.get(b)!.map((id) => dagreGraph.node(id).y)))
    .forEach((key) => {
      const ids = groups.get(key)!;
      const ys = ids.map((id) => dagreGraph.node(id).y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const start = cursor === -Infinity ? minY : cursor + GROUP_GAP;
      const dy = start - minY;
      ids.forEach((id) => yShift.set(id, dy));
      cursor = maxY + dy;
    });

  // Centre the Notes root vertically on its (shifted) first-level children.
  const firstLevel = nodes.filter((node) => parentOf.get(node.id) === GRAPH_ROOT_ID);
  if (firstLevel.length > 0 && dagreGraph.node(GRAPH_ROOT_ID)) {
    const meanY = firstLevel.reduce(
      (sum, node) => sum + dagreGraph.node(node.id).y + (yShift.get(node.id) ?? 0), 0,
    ) / firstLevel.length;
    yShift.set(GRAPH_ROOT_ID, meanY - dagreGraph.node(GRAPH_ROOT_ID).y);
  }

  const layoutedNodes: Node[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y + (yShift.get(node.id) ?? 0) - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}