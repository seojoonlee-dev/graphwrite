import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, useNodesState, SelectionMode, Panel, Handle, Position, type Node, type NodeProps, type Viewport, type ReactFlowInstance, type Connection, type Edge, type OnConnectStartParams, type FinalConnectionState } from '@xyflow/react';
import { getLayoutedElements, GRAPH_ROOT_ID } from '../helpers/graphLayout';
import { TintedImage } from './tintedImage';
import { ContextMenu } from './contextMenu';
import { loadSavedViewport, saveViewport } from '../helpers/graphStorage';
import { validateRename } from '../helpers/paths';
import { useLongPress } from '../hooks/useLongPress';
import '@xyflow/react/dist/style.css';
import '../style/graph.css';

interface GraphViewProps {
  files: string[];
  onNodeClick: (path: string) => void;
  onNodeRename: (path: string, newTitle: string) => void;
  onNodeMove: (dirPath: string, newParentPath: string) => void;
  onNodeCreate: (path: string, position?: { x: number; y: number }) => void;
  onNodeDelete: (path: string) => void;
}

interface FileNodeData {
  label: string;
  filePath?: string;
  isRoot?: boolean;
  hasChildren?: boolean;
  renaming?: boolean;
  onRenameCommit?: (value: string) => void;
  onRenameCancel?: () => void;
}

// Lets FileNode open the context menu (touch long-press) without remapping
// every node's data, which would break ReactFlow's node memoization.
const NodeContextMenuContext = createContext<((x: number, y: number, path: string) => void) | null>(null);

const FileNode = ({ id, data }: NodeProps) => {
  const { label, filePath, hasChildren, renaming, onRenameCommit, onRenameCancel } = data as unknown as FileNodeData;
  const openMenu = useContext(NodeContextMenuContext);
  const longPress = useLongPress();

  // The node itself is just a dot; the label sits outside it — to the left for
  // branch nodes (so it tucks toward the parent) and to the right for leaves.
  const side = hasChildren ? 'label-left' : 'label-right';

  return (
    <>
      <Handle type="target" position={Position.Left} />
      {renaming ? (
        <input
          className={`graph-node-rename ${side} nodrag`}
          defaultValue={label}
          autoFocus
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameCommit?.(e.currentTarget.value);
            if (e.key === 'Escape') onRenameCancel?.();
          }}
          onBlur={(e) => onRenameCommit?.(e.currentTarget.value)}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`graph-node-label ${side}`}
          {...(openMenu && filePath ? longPress((x, y) => openMenu(x, y, id), true) : {})}
        >
          {label}
        </span>
      )}
      <Handle type="source" position={Position.Right} />
    </>
  );
};

const nodeTypes = { fileNode: FileNode };

export const GraphView: React.FC<GraphViewProps> = ({ files, onNodeClick, onNodeRename, onNodeMove, onNodeCreate, onNodeDelete }) => {
  // Nodes are locked (not draggable), so the layout is always the fresh dagre
  // tree — no saved per-node positions to merge.
  const { nodes: layoutedNodes, edges } = useMemo(() => getLayoutedElements(files), [files]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);  

  useEffect(() => {
    setNodes(layoutedNodes);
  }, [layoutedNodes, setNodes]);

  const handleNodeDoubleClick = (_event: React.MouseEvent, node: Node) => {
    if (node.data?.filePath && typeof node.data.filePath === 'string') {
      onNodeClick(node.data.filePath);
    }
  };

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);

  const handleNodeContextMenu = (event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (node.data?.filePath && typeof node.data.filePath === 'string') {
      setContextMenu({ x: event.clientX, y: event.clientY, path: node.id });
    }
  };

  const openNodeMenu = useCallback((x: number, y: number, path: string) => {
    setContextMenu({ x, y, path });
  }, []);

  const [renaming, setRenaming] = useState<string | null>(null);

  const commitRename = useCallback((value: string) => {
    if (!renaming) return;
    const newTitle = validateRename(renaming, value);
    if (newTitle) {
      onNodeRename(renaming, newTitle);
    }
    setRenaming(null);
  }, [renaming, onNodeRename]);

  const displayNodes = useMemo(() => {
    if (!renaming) return nodes;
    return nodes.map((node) =>
      node.id === renaming
        ? { ...node, data: { ...node.data, renaming: true, onRenameCommit: commitRename, onRenameCancel: () => setRenaming(null) } }
        : node
    );
  }, [nodes, renaming, commitRename]);

  const savedViewport = useMemo(() => loadSavedViewport(), []);

  const handleMoveEnd = (_event: unknown, viewport: Viewport) => {
    saveViewport(viewport);
  };

  const instanceRef = useRef<ReactFlowInstance | null>(null);

  // Re-fit the whole tree into view (the layout itself is automatic).
  const handleFitView = () => {
    instanceRef.current?.fitView();
  };

  // Re-parenting via the graph: an edge runs parent (source) -> child (target),
  // so a new/changed connection means "move the child node under the source".
  // Drawing a fresh edge from any node onto another re-parents it; that also
  // works for top-level notes, which have no incoming edge to drag.
  // Dropping a connection on the Notes root (source) means "move to top level".
  const handleConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.target === GRAPH_ROOT_ID) return;
    onNodeMove(c.target, c.source === GRAPH_ROOT_ID ? '' : c.source);
  }, [onNodeMove]);

  // Right-click an edge to disconnect it: the child detaches from its parent and
  // moves to the top level.
  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    onNodeMove(edge.target, '');
  }, [onNodeMove]);

  // Tracks whether a reconnect drag landed on a node; if it didn't (dropped on
  // empty canvas), we treat it as "move to the top level".
  const reconnectLanded = useRef(true);

  const handleReconnectStart = useCallback(() => {
    reconnectLanded.current = false;
  }, []);

  const handleReconnect = useCallback((_oldEdge: Edge, c: Connection) => {
    reconnectLanded.current = true;
    if (!c.source || !c.target || c.target === GRAPH_ROOT_ID) return;
    onNodeMove(c.target, c.source === GRAPH_ROOT_ID ? '' : c.source);
  }, [onNodeMove]);

  const handleReconnectEnd = useCallback((_event: unknown, edge: Edge) => {
    if (!reconnectLanded.current) {
      reconnectLanded.current = true;
      onNodeMove(edge.target, ''); // detach from its parent -> top level
    }
  }, [onNodeMove]);

  // Block connections that would make a note its own ancestor's child
  // (self-loops and dropping a parent onto one of its descendants).
  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target || c.source === c.target) return false;
    if (c.target === GRAPH_ROOT_ID) return false; // the Notes root can't become a child
    if (c.source !== GRAPH_ROOT_ID && c.source.startsWith(c.target + '/')) return false;
    return true;
  }, []);

  // Drag-out-to-create (node-editor style): start a connection from a node's
  // output handle and release on empty canvas to get a "New Note Here" popup
  // that creates a child of that node at the drop point.
  const connectSourceRef = useRef<string | null>(null);
  const [connectMenu, setConnectMenu] = useState<{ x: number; y: number; sourceId: string } | null>(null);

  const handleConnectStart = useCallback((_event: unknown, params: OnConnectStartParams) => {
    connectSourceRef.current = params.handleType === 'source' ? params.nodeId : null;
  }, []);

  const handleConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    const sourceId = connectSourceRef.current;
    connectSourceRef.current = null;
    // Only when released on blank canvas (no target node) after a real drag from
    // an output handle. Drops onto a node are handled by onConnect (re-parent).
    if (!sourceId || state.toNode) return;
    const point = 'changedTouches' in event ? event.changedTouches[0] : event;
    setConnectMenu({ x: point.clientX, y: point.clientY, sourceId });
  }, []);

  const handleCreateFromConnect = useCallback(() => {
    if (!connectMenu) return;
    // Dragging from the Notes root creates a top-level note; the tree
    // auto-lays-out, so the new child just slots in (no drop position).
    onNodeCreate(connectMenu.sourceId === GRAPH_ROOT_ID ? '' : connectMenu.sourceId);
    setConnectMenu(null);
  }, [connectMenu, onNodeCreate]);

  return (
    <div className="graph-view">
      <NodeContextMenuContext.Provider value={openNodeMenu}>
      <ReactFlow
        onInit={(instance) => { instanceRef.current = instance; }}
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements
        onNodesChange={onNodesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onMoveEnd={handleMoveEnd}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onEdgeContextMenu={handleEdgeContextMenu}
        onReconnectStart={handleReconnectStart}
        onReconnect={handleReconnect}
        onReconnectEnd={handleReconnectEnd}
        isValidConnection={isValidConnection}
        defaultViewport={savedViewport ?? undefined}
        fitView={!savedViewport}
        nodesDraggable={false}
        selectionOnDrag={false}
        selectionKeyCode="Shift"
        selectionMode={SelectionMode.Partial}
        panOnDrag
        zoomOnDoubleClick={false}
        proOptions={{hideAttribution: true}}
      >
        <Panel position="bottom-right">
          <button className= "btn-header" id="btn-reset" onClick={handleFitView}>
            <TintedImage src='/reset.svg' alt='reset'></TintedImage>
          </button>
        </Panel>
      </ReactFlow>
      </NodeContextMenuContext.Provider>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onCreate={onNodeCreate}
          onRename={setRenaming}
          onDelete={onNodeDelete}
        />
      )}
      {connectMenu && (
        <>
          <div
            className="context-menu-backdrop"
            style={{ pointerEvents: 'auto' }}
            onClick={() => setConnectMenu(null)}
          />
          <div className="context-menu" style={{ top: connectMenu.y, left: connectMenu.x }}>
            <button className="context-menu-item" onClick={handleCreateFromConnect}>
              Create New Note
            </button>
          </div>
        </>
      )}
    </div>
  );
};