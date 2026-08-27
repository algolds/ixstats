"use client";

import React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

// Custom React Flow node
function CalcNode({ data, selected }: NodeProps) {
  const category = (data.category as string) || "baseline";
  const inputs = (data.inputs as string[]) || [];
  const outputs = (data.outputs as string[]) || [];

  const borderColors: Record<string, string> = {
    baseline: "border-sky-500/40 hover:border-sky-400 focus:border-sky-400",
    settings: "border-amber-500/40 hover:border-amber-400 focus:border-amber-400",
    storyteller: "border-indigo-500/40 hover:border-indigo-400 focus:border-indigo-400",
    popGrowth: "border-teal-500/40 hover:border-teal-400 focus:border-teal-400",
    gdpGrowth: "border-purple-500/40 hover:border-purple-400 focus:border-purple-400",
    rawGdpGrowth: "border-purple-500/40 hover:border-purple-400 focus:border-purple-400",
    diminishingReturns: "border-yellow-500/40 hover:border-yellow-400 focus:border-yellow-400",
    tierCap: "border-pink-500/40 hover:border-pink-400 focus:border-pink-400",
    progression: "border-orange-500/40 hover:border-orange-400 focus:border-orange-400",
    directModifiers: "border-red-500/40 hover:border-red-400 focus:border-red-400",
    output: "border-emerald-500/40 hover:border-emerald-400 focus:border-emerald-400",
    vitality: "border-emerald-500/40 hover:border-emerald-400 focus:border-emerald-400",
    wellbeing: "border-teal-500/40 hover:border-teal-400 focus:border-teal-400",
    efficiency: "border-purple-500/40 hover:border-purple-400 focus:border-purple-400",
    diplomatic: "border-indigo-500/40 hover:border-indigo-400 focus:border-indigo-400",
  };

  const bgGlows: Record<string, string> = {
    baseline: "rgba(14, 165, 233, 0.03)",
    settings: "rgba(245, 158, 11, 0.03)",
    storyteller: "rgba(99, 102, 241, 0.03)",
    popGrowth: "rgba(20, 184, 166, 0.03)",
    gdpGrowth: "rgba(168, 85, 247, 0.03)",
    rawGdpGrowth: "rgba(168, 85, 247, 0.03)",
    diminishingReturns: "rgba(234, 179, 8, 0.03)",
    tierCap: "rgba(236, 72, 153, 0.03)",
    progression: "rgba(249, 115, 22, 0.03)",
    directModifiers: "rgba(239, 68, 68, 0.03)",
    output: "rgba(16, 185, 129, 0.03)",
    vitality: "rgba(16, 185, 129, 0.03)",
    wellbeing: "rgba(20, 184, 166, 0.03)",
    efficiency: "rgba(168, 85, 247, 0.03)",
    diplomatic: "rgba(99, 102, 241, 0.03)",
  };

  const glowColors: Record<string, string> = {
    baseline: "shadow-sky-500/5",
    settings: "shadow-amber-500/5",
    storyteller: "shadow-indigo-500/5",
    popGrowth: "shadow-teal-500/5",
    gdpGrowth: "shadow-purple-500/5",
    rawGdpGrowth: "shadow-purple-500/5",
    diminishingReturns: "shadow-yellow-500/5",
    tierCap: "shadow-pink-500/5",
    progression: "shadow-orange-500/5",
    directModifiers: "shadow-red-500/5",
    output: "shadow-emerald-500/5",
    vitality: "shadow-emerald-500/5",
    wellbeing: "shadow-teal-500/5",
    efficiency: "shadow-purple-500/5",
    diplomatic: "shadow-indigo-500/5",
  };

  return (
    <div
      className={cn(
        "bg-card/90 relative min-w-[210px] rounded-xl border p-4 text-left shadow-lg backdrop-blur-md transition-all duration-300",
        borderColors[category] || "border-border",
        glowColors[category],
        selected
          ? "border-primary shadow-primary/10 ring-primary/30 scale-105 shadow-xl ring-1"
          : ""
      )}
      style={{
        backgroundColor: bgGlows[category],
      }}
    >
      {/* Handles */}
      {inputs.map((pos) => {
        let position = Position.Left;
        if (pos === "top") position = Position.Top;
        if (pos === "bottom") position = Position.Bottom;
        if (pos === "right") position = Position.Right;

        return (
          <Handle
            key={pos}
            type="target"
            id={pos}
            position={position}
            className="border-background !bg-primary !h-2.5 !w-2.5 border transition-all duration-200"
          />
        );
      })}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
            {data.title as string}
          </span>
          {selected && (
            <Badge className="bg-primary/20 text-primary h-3.5 border-0 px-1 text-[8px] select-none">
              Selected
            </Badge>
          )}
        </div>
        <div className="text-foreground truncate text-sm font-extrabold">
          {data.mainValue as string}
        </div>
        <div className="text-muted-foreground truncate text-[10px]">{data.subValue as string}</div>
      </div>

      {outputs.map((pos) => {
        let position = Position.Right;
        if (pos === "top") position = Position.Top;
        if (pos === "bottom") position = Position.Bottom;
        if (pos === "left") position = Position.Left;

        return (
          <Handle
            key={pos}
            type="source"
            id={pos}
            position={position}
            className="border-background !bg-primary !h-2.5 !w-2.5 border transition-all duration-200"
          />
        );
      })}
    </div>
  );
}

const nodeTypes = {
  calcNode: CalcNode,
};

export interface CountryFormulaFlowProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
}

export function CountryFormulaFlow({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
}: CountryFormulaFlowProps) {
  return (
    <div className="border-border/40 bg-card/30 relative h-[480px] w-full overflow-hidden rounded-xl border shadow-inner">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={true}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        selectNodesOnDrag={false}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background color="#444" gap={16} size={1} />
        <Controls
          showInteractive={false}
          className="bg-popover border-border text-foreground border"
        />
        <Panel
          position="top-left"
          className="bg-background/80 border-border/55 text-muted-foreground rounded-lg border px-3 py-1.5 text-[9px] shadow-sm backdrop-blur-sm select-none"
        >
          <span className="mr-1 font-bold text-indigo-500">💡 Formula Map:</span>
          Click nodes to inspect formulas and values in the details panel below.
        </Panel>
      </ReactFlow>
    </div>
  );
}
export default CountryFormulaFlow;
