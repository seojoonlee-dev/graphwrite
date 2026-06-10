import React, { useEffect, useMemo } from 'react';
import { ReactFlow, useNodesState, type Node } from '@xyflow/react';
import { getLayoutedElements } from './helpers/GraphLayout';
import '@xyflow/react/dist/style.css';
import './style/Graph.css';

interface GraphViewProps {
  files: string[];
  onNodeClick: (path: string) => void;
}

const POSITIONS_KEY = 'graphNodePositions';

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function migrateSavedPositions(oldDirPath: string, newDirPath: string) {
  const saved = loadSavedPositions();
  const migrated: Record<string, { x: number; y: number }> = {};
  let changed = false;

  Object.entries(saved).forEach(([id, position]) => {
    if (id === oldDirPath) {
      migrated[newDirPath] = position;
      changed = true;
    } else if (id.startsWith(oldDirPath + '/')) {
      migrated[newDirPath + id.slice(oldDirPath.length)] = position;
      changed = true;
    } else {
      migrated[id] = position;
    }
  });

  if (changed) {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(migrated));
  }
}

export const GraphView: React.FC<GraphViewProps> = ({ files, onNodeClick }) => {
  const { nodes: layoutedNodes, edges } = useMemo(() => {
    const { nodes, edges } = getLayoutedElements(files);
    const saved = loadSavedPositions();
    return {
      nodes: nodes.map((node) =>
        saved[node.id] ? { ...node, position: saved[node.id] } : node
      ),
      edges,
    };
  }, [files]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);  

  useEffect(() => {
    setNodes(layoutedNodes);
  }, [layoutedNodes, setNodes]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    if (node.data?.filePath && typeof node.data.filePath === 'string') {
      onNodeClick(node.data.filePath);
    }
  };

  const handleNodeDragStop = () => {
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node) => {
      positions[node.id] = node.position;
    });
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  };

  return (
    <div className="graph-view">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        fitView
        nodesConnectable={false}
        nodesDraggable={true}
        proOptions={{hideAttribution: true}}
      >
      </ReactFlow>
    </div>
  );
};