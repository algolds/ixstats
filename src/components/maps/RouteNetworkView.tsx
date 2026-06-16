"use client";

import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Share2 } from "lucide-react";
import { api } from "~/trpc/react";
import { buildRouteNetworkGraph } from "~/lib/route-network-graph";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "~/components/ui/dialog";

function RouteNetworkView({ countryId }: { countryId: string }) {
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

export function RouteNetworkButton({ countryId }: { countryId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="absolute top-3 right-3 z-20 gap-1.5"
          title="Route network view"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Network</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[80vh] max-w-5xl p-0">
        <DialogTitle className="sr-only">Route Network</DialogTitle>
        <div className="h-full w-full">
          <RouteNetworkView countryId={countryId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
