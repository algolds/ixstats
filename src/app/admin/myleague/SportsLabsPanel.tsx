"use client";

import React, { useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { SportsLabsInspector } from "~/components/admin/sports-labs/SportsLabsInspector";
import { cn } from "~/lib/utils";
import {
  Trophy,
  Group as Users,
  Calendar,
  Tournament as Swords,
  ControlSlider as Sliders,
  Database,
  Flask as FlaskConical,
} from "iconoir-react";

// Custom Node Component
function PipelineNode({ data, selected }: NodeProps) {
  const Icon = data.icon as any;
  const inputPositions = (data.inputs as string[]) || [];
  const outputPositions = (data.outputs as string[]) || [];

  return (
    <div
      className={cn(
        "relative min-w-[210px] rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md transition-all duration-300",
        selected
          ? "scale-105 border-amber-500 bg-amber-500/10 shadow-amber-500/10"
          : "bg-card/90 border-border/80 hover:border-muted-foreground/40"
      )}
    >
      {/* Target Handles */}
      {inputPositions.map((pos) => {
        let position = Position.Top;
        if (pos === "bottom") position = Position.Bottom;
        if (pos === "left") position = Position.Left;
        if (pos === "right") position = Position.Right;

        return (
          <Handle
            key={pos}
            type="target"
            id={pos}
            position={position}
            className="border-background !h-2 !w-2 border !bg-amber-500"
          />
        );
      })}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "border-border/40 bg-muted/40 flex h-8 w-8 items-center justify-center rounded-lg border",
            selected ? "border-amber-500/50 text-amber-500" : "text-muted-foreground"
          )}
        >
          {Icon && <Icon className="h-4.5 w-4.5" />}
        </div>
        <div className="text-left">
          <div className="text-foreground text-[11px] leading-tight font-bold">
            {data.label as string}
          </div>
          <div className="text-muted-foreground text-[9px]">{data.description as string}</div>
        </div>
      </div>

      {/* Source Handles */}
      {outputPositions.map((pos) => {
        let position = Position.Bottom;
        if (pos === "top") position = Position.Top;
        if (pos === "left") position = Position.Left;
        if (pos === "right") position = Position.Right;

        return (
          <Handle
            key={pos}
            type="source"
            id={pos}
            position={position}
            className="border-background !h-2 !w-2 border !bg-amber-500"
          />
        );
      })}
    </div>
  );
}

const nodeTypes = {
  pipelineNode: PipelineNode,
};

export default function SportsLabsPanel() {
  const [isSandbox, setIsSandbox] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("presets");
  const [selectedSport, setSelectedSport] = useState<string>("soccer");

  const sportColors: Record<string, string> = {
    soccer: "#10b981", // emerald green
    hockey: "#38bdf8", // sky ice blue
    basketball: "#f97316", // basketball orange
    football: "#a855f7", // football purple
    baseball: "#facc15", // baseball yellow
    f1: "#ef4444", // racing red
    boxing: "#ec4899", // boxing pink
  };

  const sportBgGlows: Record<string, string> = {
    soccer: "rgba(16, 185, 129, 0.05)",
    hockey: "rgba(56, 189, 248, 0.05)",
    basketball: "rgba(249, 115, 22, 0.05)",
    football: "rgba(168, 85, 247, 0.05)",
    baseball: "rgba(250, 204, 21, 0.05)",
    f1: "rgba(239, 68, 68, 0.05)",
    boxing: "rgba(236, 72, 153, 0.05)",
  };

  const dynamicNodes = React.useMemo(() => {
    const color = sportColors[selectedSport] || "#3b82f6";
    const bgGlow = sportBgGlows[selectedSport] || "rgba(59, 130, 246, 0.05)";

    const sportLabel =
      selectedSport === "soccer"
        ? "Association Football"
        : selectedSport === "hockey"
          ? "Ice Hockey"
          : selectedSport === "football"
            ? "American Football"
            : selectedSport === "basketball"
              ? "Basketball"
              : selectedSport === "baseball"
                ? "Baseball"
                : selectedSport === "f1"
                  ? "F1 / Motorsport"
                  : selectedSport === "boxing"
                    ? "Boxing"
                    : selectedSport;

    return [
      {
        id: "presets",
        type: "pipelineNode",
        data: {
          label: "Sport Presets",
          description: `Active Preset: ${sportLabel}`,
          icon: Trophy,
          inputs: [],
          outputs: ["bottom"],
        },
        position: { x: 30, y: 30 },
        style: {
          border: `1px solid ${color}`,
          backgroundColor: bgGlow,
          boxShadow: `0 0 12px ${bgGlow}`,
        },
      },
      {
        id: "rosters",
        type: "pipelineNode",
        data: {
          label: "Talent & Roster Gen",
          description:
            selectedSport === "hockey"
              ? "Supports line shifts, goalies & saints"
              : selectedSport === "f1"
                ? "Supports drivers & engineers"
                : selectedSport === "boxing"
                  ? "Supports individual fighters"
                  : "Supports positions, squads & saints",
          icon: Users,
          inputs: ["top", "right"],
          outputs: ["bottom"],
        },
        position: { x: 30, y: 190 },
        style: {
          border: `1px solid ${color}`,
          backgroundColor: bgGlow,
          boxShadow: `0 0 12px ${bgGlow}`,
        },
      },
      {
        id: "schedule",
        type: "pipelineNode",
        data: {
          label: "Schedule Generator",
          description:
            selectedSport === "f1"
              ? "Supports Circuit race schedules"
              : selectedSport === "boxing"
                ? "Supports Bracket elimination pairs"
                : "Supports Round-Robin & Multi-Stage",
          icon: Calendar,
          inputs: ["top"],
          outputs: ["right"],
        },
        position: { x: 30, y: 350 },
        style: {
          border: `1px solid ${color}`,
          backgroundColor: bgGlow,
          boxShadow: `0 0 12px ${bgGlow}`,
        },
      },
      {
        id: "resolver",
        type: "pipelineNode",
        data: {
          label: "Match Resolver",
          description:
            selectedSport === "hockey"
              ? "Periods, goalie pulling, shootout, blessings"
              : selectedSport === "soccer"
                ? "Standard intervals, shootout, blessings"
                : "ELO simulation & Storyteller effects",
          icon: Swords,
          inputs: ["left"],
          outputs: ["top"],
        },
        position: { x: 330, y: 350 },
        style: {
          border: `1px solid ${color}`,
          backgroundColor: bgGlow,
          boxShadow: `0 0 12px ${bgGlow}`,
        },
      },
      {
        id: "standings",
        type: "pipelineNode",
        data: {
          label: "Standings & Table",
          description:
            selectedSport === "f1"
              ? "F1 Championship points standings"
              : selectedSport === "boxing"
                ? "Bracket progression & rank standings"
                : "Standings table with Prom/Releg zones",
          icon: Trophy,
          inputs: ["bottom"],
          outputs: ["top"],
        },
        position: { x: 330, y: 190 },
        style: {
          border: `1px solid ${color}`,
          backgroundColor: bgGlow,
          boxShadow: `0 0 12px ${bgGlow}`,
        },
      },
      {
        id: "aging",
        type: "pipelineNode",
        data: {
          label: "Aging & Transition",
          description:
            selectedSport === "soccer" || selectedSport === "hockey"
              ? "Promo-swaps & Quadrennial WC cycles"
              : "Career aging & rookie drafts",
          icon: Sliders,
          inputs: ["bottom"],
          outputs: ["left"],
        },
        position: { x: 330, y: 30 },
        style: {
          border: `1px solid ${color}`,
          backgroundColor: bgGlow,
          boxShadow: `0 0 12px ${bgGlow}`,
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport]);

  const dynamicEdges = React.useMemo(() => {
    const color = sportColors[selectedSport] || "#3b82f6";
    return [
      {
        id: "e-presets-rosters",
        source: "presets",
        target: "rosters",
        sourceHandle: "bottom",
        targetHandle: "top",
        animated: true,
        style: { stroke: color, strokeWidth: 1.5 },
      },
      {
        id: "e-rosters-sched",
        source: "rosters",
        target: "schedule",
        sourceHandle: "bottom",
        targetHandle: "top",
        animated: true,
        style: { stroke: color, strokeWidth: 1.5 },
      },
      {
        id: "e-sched-resolver",
        source: "schedule",
        target: "resolver",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: color, strokeWidth: 1.5 },
      },
      {
        id: "e-resolver-standings",
        source: "resolver",
        target: "standings",
        sourceHandle: "top",
        targetHandle: "bottom",
        animated: true,
        style: { stroke: color, strokeWidth: 1.5 },
      },
      {
        id: "e-standings-aging",
        source: "standings",
        target: "aging",
        sourceHandle: "top",
        targetHandle: "bottom",
        animated: true,
        style: { stroke: color, strokeWidth: 1.5 },
      },
      {
        id: "e-aging-rosters",
        source: "aging",
        target: "rosters",
        sourceHandle: "left",
        targetHandle: "right",
        animated: true,
        style: { stroke: "#a855f7", strokeWidth: 1.5 },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport]);

  const [nodes, setNodes, onNodesChange] = useNodesState(dynamicNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(dynamicEdges);

  React.useEffect(() => {
    setNodes(dynamicNodes);
  }, [dynamicNodes, setNodes]);

  React.useEffect(() => {
    setEdges(dynamicEdges);
  }, [dynamicEdges, setEdges]);

  const handleNodeClick = (_event: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  };

  return (
    <div className="space-y-6">
      {/* Header with AdminHeader */}
      <div className="facet-hierarchy-parent border-border/60 bg-card/40 flex flex-col justify-between gap-4 rounded-xl border p-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="border-border/50 bg-muted/30 flex h-12 w-12 items-center justify-center rounded-xl border text-amber-500">
            <FlaskConical className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold">
              MatchResolver
              <Badge
                variant="outline"
                className="border-amber-500/20 bg-amber-500/10 text-[10px] font-semibold text-amber-400 uppercase"
              >
                Simulation Kernel Layer
              </Badge>
            </h1>
          </div>
        </div>

        {/* Toggle Mode */}
        <div className="bg-muted/20 flex shrink-0 items-center gap-1.5 self-start rounded-lg border p-1 md:self-auto">
          <Button
            size="sm"
            variant={isSandbox ? "default" : "ghost"}
            onClick={() => setIsSandbox(true)}
            className="h-7.5 px-3 text-xs"
          >
            <FlaskConical className="mr-1 h-3.5 w-3.5" />
            Sandbox Playground
          </Button>
          <Button
            size="sm"
            variant={!isSandbox ? "default" : "ghost"}
            onClick={() => setIsSandbox(false)}
            className="h-7.5 px-3 text-xs"
          >
            <Database className="mr-1 h-3.5 w-3.5" />
            Live DB Inspector
          </Button>
        </div>
      </div>

      {/* Main Grid: Left canvas + Right inspector */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Canvas Section */}
        <div className="relative flex h-[650px] flex-col lg:col-span-7">
          <Card className="facet-hierarchy-child border-border/60 bg-card/30 relative flex-1 overflow-hidden rounded-xl">
            <ReactFlow
              nodes={nodes.map((n) => ({
                ...n,
                selected: n.id === selectedNodeId,
              }))}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              attributionPosition="bottom-right"
              nodesDraggable={true}
              nodesConnectable={false}
              zoomOnDoubleClick={false}
              selectNodesOnDrag={false}
            >
              <Background color="#555" gap={16} size={1} />
              <Controls
                showInteractive={false}
                className="bg-popover border-border text-foreground border"
              />
              <Panel
                position="top-left"
                className="bg-background/80 border-border/60 text-muted-foreground rounded-lg border px-3 py-1.5 text-[10px] shadow-sm backdrop-blur-sm select-none"
              >
                <span className="mr-1 font-bold text-amber-500">💡 Pipeline Loop:</span> Click nodes
                to select and configure settings in the inspector.
              </Panel>
            </ReactFlow>
          </Card>
        </div>

        {/* Inspector Section */}
        <div className="h-[650px] lg:col-span-5">
          <SportsLabsInspector
            selectedNodeId={selectedNodeId}
            isSandbox={isSandbox}
            selectedSport={selectedSport as any}
            setSelectedSport={setSelectedSport}
          />
        </div>
      </div>
    </div>
  );
}
