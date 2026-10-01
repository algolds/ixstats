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
    baseline: "border-blue/40 hover:border-blue focus:border-blue",
    settings: "border-yellow/40 hover:border-yellow focus:border-yellow",
    storyteller: "border-indigo/40 hover:border-indigo focus:border-indigo",
    popGrowth: "border-teal/40 hover:border-teal focus:border-teal",
    gdpGrowth: "border-purple/40 hover:border-purple focus:border-purple",
    rawGdpGrowth: "border-purple/40 hover:border-purple focus:border-purple",
    diminishingReturns: "border-yellow/40 hover:border-yellow focus:border-yellow",
    tierCap: "border-pink/40 hover:border-pink focus:border-pink",
    progression: "border-orange/40 hover:border-orange focus:border-orange",
    directModifiers: "border-red/40 hover:border-red focus:border-red",
    output: "border-green/40 hover:border-green focus:border-green",
    vitality: "border-green/40 hover:border-green focus:border-green",
    wellbeing: "border-teal/40 hover:border-teal focus:border-teal",
    efficiency: "border-purple/40 hover:border-purple focus:border-purple",
    diplomatic: "border-indigo/40 hover:border-indigo focus:border-indigo",
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
    baseline: "",
    settings: "",
    storyteller: "",
    popGrowth: "",
    gdpGrowth: "",
    rawGdpGrowth: "",
    diminishingReturns: "",
    tierCap: "",
    progression: "",
    directModifiers: "",
    output: "",
    vitality: "",
    wellbeing: "",
    efficiency: "",
    diplomatic: "",
  };

  return (
    <div
      className={cn(
        "bg-surface rounded-row duration-fast relative min-w-[210px] border p-4 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform]",
        borderColors[category] || "border-separator",
        glowColors[category],
        selected ? "border-tint ring-tint/30 scale-105 ring-1" : ""
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
            className="border-background !bg-tint duration-fast !h-2.5 !w-2.5 border transition-[color,background-color,border-color,box-shadow,opacity,transform]"
          />
        );
      })}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-label-secondary text-eyebrow">{data.title as string}</span>
          {selected && (
            <Badge className="bg-tint-fill text-tint h-3.5 border-0 px-1 select-none">
              Selected
            </Badge>
          )}
        </div>
        <div className="text-label text-headline truncate">{data.mainValue as string}</div>
        <div className="text-label-secondary text-footnote truncate">{data.subValue as string}</div>
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
            className="border-background !bg-tint duration-fast !h-2.5 !w-2.5 border transition-[color,background-color,border-color,box-shadow,opacity,transform]"
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
    <div className="border-separator bg-surface rounded-row relative h-[480px] w-full overflow-hidden border">
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
        <Background color="var(--color-separator-opaque)" gap={16} size={1} />
        <Controls
          showInteractive={false}
          className="bg-surface-elevated border-separator text-label border"
        />
        <Panel
          position="top-left"
          className="bg-background border-separator text-label-secondary rounded-control text-footnote border px-3 py-1.5 select-none"
        >
          <span className="text-indigo mr-1 font-semibold">💡 Formula Map:</span>
          Click nodes to inspect formulas and values in the details panel below.
        </Panel>
      </ReactFlow>
    </div>
  );
}
export default CountryFormulaFlow;
