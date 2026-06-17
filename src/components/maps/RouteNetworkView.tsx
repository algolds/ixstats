"use client";

import { useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "~/trpc/react";
import { buildRouteNetworkGraph } from "~/lib/route-network-graph";

export function RouteNetworkView({ countryId }: { countryId: string }) {
  const { data: routeData } = api.transport.getCountryRoutes.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: hubs } = api.transport.getCountryHubs.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  useEffect(() => {
    const { nodes: n, edges: e } = buildRouteNetworkGraph(
      (routeData?.features as any[]) ?? [],
      (hubs as any[]) ?? []
    );
    setNodes(n);
    setEdges(e);
  }, [routeData, hubs, setNodes, setEdges]);

  if (nodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full w-full items-center justify-center text-sm">
        No transport hubs to graph yet. Add hubs and routes in the editor.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      nodesDraggable
    >
      <Background color="#444" gap={16} size={1} />
      <Controls />
    </ReactFlow>
  );
}
