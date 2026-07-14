"use client"
import { useMemo } from 'react';
import { ReactFlow, MarkerType, type Node, type Edge } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

type GraphTodo = {
  id: number;
  title: string;
  completed: boolean;
  dependencies: { dependsOn: { id: number } }[];
};

const NODE_WIDTH = 172;
const NODE_HEIGHT = 36;
const ACCENT = '#4f46e5'; // indigo, used for critical path + glow

// Purely presentational: the parent owns the schedule fetch (one per
// mutation) and passes criticalPath + loading down.
export default function DependencyGraph({
  todos,
  criticalPath,
  loading,
}: {
  todos: GraphTodo[];
  criticalPath: string[];
  loading: boolean;
}) {
  const { nodes, edges } = useMemo(() => {
    const critical = new Set(criticalPath);
    const done = new Set(todos.filter((t) => t.completed).map((t) => String(t.id)));
    // consecutive critical-path pairs, e.g. "9->10"
    const criticalEdges = new Set(
      criticalPath.slice(1).map((id, i) => `${criticalPath[i]}->${id}`)
    );

    const edges: Edge[] = todos.flatMap((t) =>
      (t.dependencies ?? []).map((d) => {
        const source = String(d.dependsOn.id);
        const target = String(t.id);
        // indigo only on the still-incomplete portion of the path
        const onPath =
          criticalEdges.has(`${source}->${target}`) &&
          !done.has(source) &&
          !done.has(target);
        return {
          id: `${source}-${target}`,
          source,
          target,
          style: onPath
            ? { stroke: ACCENT, strokeWidth: 2 }
            : { stroke: '#cbd5e1' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: onPath ? ACCENT : '#cbd5e1',
          },
        };
      })
    );

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    // tighter spacing so fitView lands at a higher zoom and fills the canvas
    g.setGraph({ rankdir: 'TB', nodesep: 24, ranksep: 48 });
    todos.forEach((t) =>
      g.setNode(String(t.id), { width: NODE_WIDTH, height: NODE_HEIGHT })
    );
    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);

    const nodes: Node[] = todos.map((t) => {
      const id = String(t.id);
      const pos = g.node(id);
      // completed style wins over critical: a finished task no longer needs emphasis
      const onPath = critical.has(id) && !t.completed;
      return {
        id,
        data: { label: t.completed ? `✓ ${t.title}` : t.title },
        position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
        style: t.completed
          ? {
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              color: '#94a3b8',
              opacity: 0.6,
              textDecoration: 'line-through',
            }
          : // incomplete: full-color text either way; indigo border is the
            // only critical-path signal, not a prerequisite for looking active
          onPath
          ? {
              border: `2px solid ${ACCENT}`,
              borderRadius: 8,
              fontWeight: 600,
              color: '#1e293b',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            }
          : {
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontWeight: 600,
              color: '#1e293b',
            },
      };
    });

    return { nodes, edges };
  }, [todos, criticalPath]);

  if (todos.length === 0) return null;

  return (
    <div className="graph-enter rounded-2xl p-6 bg-gradient-to-b from-white to-indigo-50 shadow-[0_24px_80px_-16px_rgba(79,70,229,0.5)]">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">
        Dependencies
      </h2>
      <p className="text-sm font-normal text-gray-500 mt-1 mb-4">
        The critical path is highlighted in indigo.
      </p>
      {loading ? (
        // skeleton is the change-in-flight signal; the graph snaps to its
        // new state on arrival, no per-node animation
        <div className="h-96 rounded-xl bg-indigo-100 bg-opacity-50 animate-pulse" />
      ) : edges.length === 0 ? (
        <p className="h-40 flex items-center justify-center text-sm text-gray-400">
          Add a dependency to see the graph
        </p>
      ) : (
        <div className="h-96">
          {/* ponytail: key forces remount so fitView re-centers on data change */}
          <ReactFlow
            key={todos.map((t) => t.id).join(',')}
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.1 }}
          />
        </div>
      )}
    </div>
  );
}
