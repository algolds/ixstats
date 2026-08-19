"use client";

// src/app/labs/onoma/components/sections/MarkovVisualizer.tsx
// Onoma Lab — Interactive Markov Chain Probability visualizer using React Flow

import React, { useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Volume2, RotateCcw, HelpCircle } from "lucide-react";
import { ScienceGameIcon } from "../nav/onoma-tabs";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { speakBrowserNative } from "~/lib/onoma/browser-speech";

// Custom node components for React Flow
function CenterNode({ data }: { data: { label: string } }) {
  return (
    <div className="text-foreground animate-in scale-in flex min-w-[125px] flex-col items-center gap-0.5 rounded-2xl border-2 border-[#0091ff] bg-[#0091ff]/15 px-5 py-3 text-center font-bold shadow-xl shadow-[#0091ff]/10 backdrop-blur-md duration-200 select-none">
      <span className="text-[9px] font-extrabold tracking-wider text-[#0091ff] uppercase">
        Active State
      </span>
      <span className="font-mono text-base leading-tight tracking-wide">
        {data.label || "[Start]"}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="l"
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="t"
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

function NeighborNode({
  data,
}: {
  data: { label: string; onClick: () => void; probability: number; targetPosition: Position };
}) {
  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#0091ff]/25 to-[#00d2ff]/25 opacity-0 blur-sm transition-all duration-300 group-hover:opacity-100" />
      <button
        onClick={data.onClick}
        className="border-border/80 bg-background/95 text-foreground relative flex min-w-[85px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-xs font-bold shadow-md backdrop-blur-md transition-all select-none hover:border-[#0091ff]/40 hover:bg-[#0091ff]/10 active:scale-95"
      >
        <span className="font-mono font-extrabold text-[#0091ff]">+{data.label}</span>
        <span className="text-muted-foreground font-sans text-[9px] font-semibold">
          ({(data.probability * 100).toFixed(0)}%)
        </span>
        <Handle
          type="target"
          position={data.targetPosition}
          id="target"
          style={{ opacity: 0, width: 0, height: 0 }}
        />
      </button>
    </div>
  );
}

function EndNode({
  data,
}: {
  data: { onClick: () => void; probability: number; targetPosition: Position };
}) {
  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-red-500/25 to-amber-500/25 opacity-0 blur-sm transition-all duration-300 group-hover:opacity-100" />
      <button
        onClick={data.onClick}
        className="relative flex min-w-[85px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/5 px-3.5 py-2 text-xs font-bold text-red-500 shadow-md backdrop-blur-md transition-all select-none hover:border-red-500/60 hover:bg-red-500/10 active:scale-95 dark:text-red-400"
      >
        <span>[End]</span>
        <span className="font-sans text-[9px] font-semibold text-red-500/80 dark:text-red-400/80">
          ({(data.probability * 100).toFixed(0)}%)
        </span>
        <Handle
          type="target"
          position={data.targetPosition}
          id="target"
          style={{ opacity: 0, width: 0, height: 0 }}
        />
      </button>
    </div>
  );
}

const nodeTypes = {
  center: CenterNode,
  neighbor: NeighborNode,
  end: EndNode,
};

// Map angle (radians) to optimal connecting handles
function getHandleConfig(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= 2 * Math.PI;
  while (normalized < -Math.PI) normalized += 2 * Math.PI;

  if (normalized >= -Math.PI / 4 && normalized < Math.PI / 4) {
    return { sourceHandle: "r", targetPosition: Position.Left };
  } else if (normalized >= Math.PI / 4 && normalized < (3 * Math.PI) / 4) {
    return { sourceHandle: "b", targetPosition: Position.Top };
  } else if (normalized >= (-3 * Math.PI) / 4 && normalized < -Math.PI / 4) {
    return { sourceHandle: "t", targetPosition: Position.Bottom };
  } else {
    return { sourceHandle: "l", targetPosition: Position.Right };
  }
}

// Subcomponent to handle automated smooth viewport panning and zooming
function FlowFitViewController({ activePrefix }: { activePrefix: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.28, duration: 400 });
    }, 60);
    return () => clearTimeout(timer);
  }, [activePrefix, fitView]);

  return null;
}

interface MarkovVisualizerProps {
  chain: MarkovChain;
  activePrefix: string;
  onChangePrefix: (newPrefix: string) => void;
  onCompleteName?: (completedName: string) => void;
}

export function MarkovVisualizerInner({
  chain,
  activePrefix,
  onChangePrefix,
  onCompleteName,
}: MarkovVisualizerProps) {
  // Query transitions
  const transitions = useMemo(() => {
    return chain.getTransitions(activePrefix);
  }, [chain, activePrefix]);

  // Handle appending clicked token
  const handleSelectToken = useCallback(
    (token: string | null) => {
      if (token === null) {
        if (activePrefix) {
          const capitalizedName = MarkovChain.capitalize(activePrefix);
          onCompleteName?.(capitalizedName);
        }
      } else {
        onChangePrefix(activePrefix + token);
      }
    },
    [activePrefix, onChangePrefix, onCompleteName]
  );

  // Compute graph nodes and edges
  const { nodes, edges } = useMemo(() => {
    const computedNodes: Node[] = [];
    const computedEdges: Edge[] = [];

    // Center Node (Active Prefix)
    computedNodes.push({
      id: "center",
      type: "center",
      data: { label: activePrefix },
      position: { x: 250, y: 250 },
    });

    if (transitions.length === 0) {
      return { nodes: computedNodes, edges: computedEdges };
    }

    const R = 175; // Radial spacing radius
    const N = transitions.length;

    transitions.forEach((t, idx) => {
      const angle = (idx * 2 * Math.PI) / N;
      const x = 250 + R * Math.cos(angle);
      const y = 250 + R * Math.sin(angle);

      const config = getHandleConfig(angle);
      const nodeId = `node-${idx}`;

      computedNodes.push({
        id: nodeId,
        type: t.token === null ? "end" : "neighbor",
        data: {
          label: t.token === null ? "[End]" : t.token,
          probability: t.probability,
          targetPosition: config.targetPosition,
          onClick: () => handleSelectToken(t.token),
        },
        position: { x: x - 42, y: y - 20 },
      });

      // Directed Edge
      computedEdges.push({
        id: `edge-${idx}`,
        source: "center",
        sourceHandle: config.sourceHandle,
        target: nodeId,
        targetHandle: "target",
        label: `${(t.probability * 100).toFixed(0)}%`,
        animated: t.probability > 0.2,
        style: {
          strokeWidth: Math.max(1.2, t.probability * 6.5),
          stroke: t.probability > 0.25 ? "#0091ff" : "var(--border)",
        },
        labelStyle: {
          fill: "var(--foreground)",
          fontWeight: "700",
          fontSize: "9px",
          fontFamily: "monospace",
        },
        labelBgStyle: {
          fill: "var(--card)",
          fillOpacity: "0.85",
          rx: 3.5,
        },
      });
    });

    return { nodes: computedNodes, edges: computedEdges };
  }, [activePrefix, transitions, handleSelectToken]);

  // Derive remaining path using transition probability distribution
  const handleDerivePath = () => {
    let current = activePrefix;
    let count = 0;
    while (count < 15) {
      const trans = chain.getTransitions(current);
      if (trans.length === 0) break;

      const rand = Math.random();
      let sum = 0;
      let selectedToken: string | null = null;
      for (const t of trans) {
        sum += t.probability;
        if (rand <= sum) {
          selectedToken = t.token;
          break;
        }
      }
      if (selectedToken === null) {
        break;
      }
      current = current + selectedToken;
      count++;
    }

    if (current && current !== activePrefix) {
      onChangePrefix(current);
      onCompleteName?.(MarkovChain.capitalize(current));
    }
  };

  // Play pronunciation via speakBrowserNative
  const handleSpeak = () => {
    if (!activePrefix) return;
    speakBrowserNative(MarkovChain.capitalize(activePrefix), "", "any").catch(() => {});
  };

  return (
    <div className="border-border/40 bg-card/40 relative flex flex-col overflow-hidden rounded-xl border backdrop-blur-md">
      {/* Control panel bar */}
      <div className="border-border/30 bg-secondary/5 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#0091ff]" />
          <h3 className="text-foreground text-xs font-bold tracking-wide uppercase">
            Markov Path Visualizer
          </h3>
        </div>

        {/* Input box showing active path */}
        <div className="flex max-w-sm flex-1 items-center gap-2 sm:justify-end">
          <span className="text-muted-foreground hidden text-[10px] font-bold uppercase sm:inline">
            Path:
          </span>
          <input
            type="text"
            value={activePrefix}
            onChange={(e) => onChangePrefix(e.target.value.toLowerCase())}
            placeholder="Type prefix or click nodes..."
            className="border-border/60 bg-background/80 text-foreground placeholder-muted-foreground flex-1 rounded-lg border px-2.5 py-1 font-mono text-xs focus:border-[#0091ff]/50 focus:outline-none sm:max-w-[200px]"
          />

          <button
            onClick={handleSpeak}
            disabled={!activePrefix}
            className="border-border/60 bg-background/50 text-muted-foreground cursor-pointer rounded-md border p-1 transition-all hover:border-[#0091ff]/40 hover:bg-[#0091ff]/10 hover:text-[#0091ff] disabled:opacity-40"
            title="Pronounce name"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDerivePath}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#0091ff]/30 bg-[#0091ff]/5 px-2.5 py-1 text-xs font-semibold text-[#0091ff] transition-all hover:bg-[#0091ff]/10"
            title="Derive remaining path to end"
          >
            <ScienceGameIcon className="h-3.5 w-3.5" />
            <span>Derive Path</span>
          </button>

          <button
            onClick={() => onChangePrefix("")}
            className="border-border/60 bg-background/50 hover:bg-secondary/40 text-muted-foreground flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all"
            title="Reset path to start"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Flow Canvas */}
      <div className="bg-secondary/5 relative h-[380px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.28 }}
          nodesDraggable={true}
          nodesConnectable={false}
          className="relative z-10"
        >
          <Background color="var(--border)" gap={20} size={1} className="opacity-40" />
          <Controls
            showInteractive={false}
            className="!bg-background/80 !border-border/60 !rounded-lg !shadow-md"
          />
          <FlowFitViewController activePrefix={activePrefix} />
        </ReactFlow>

        {/* Help tip overlay */}
        <div className="bg-background/85 border-border/40 text-muted-foreground pointer-events-none absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] shadow-sm backdrop-blur-sm select-none">
          <HelpCircle className="h-3 w-3 text-[#0091ff]/80" />
          <span>Click neighbor nodes to grow the name token-by-token</span>
        </div>
      </div>
    </div>
  );
}

// Wrap with ReactFlowProvider to enable useReactFlow hook inside FlowFitViewController
export function MarkovVisualizer(props: MarkovVisualizerProps) {
  return (
    <ReactFlowProvider>
      <MarkovVisualizerInner {...props} />
    </ReactFlowProvider>
  );
}

export default MarkovVisualizer;
