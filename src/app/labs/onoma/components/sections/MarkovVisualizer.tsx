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
import {
  Volume2,
  RotateCcw,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { MarkovChain } from "~/lib/onoma/markov-chain";

// Custom node components for React Flow
function CenterNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-5 py-3 rounded-2xl border-2 border-[#0091ff] bg-[#0091ff]/15 text-foreground font-bold shadow-xl shadow-[#0091ff]/10 backdrop-blur-md flex flex-col items-center gap-0.5 min-w-[125px] text-center select-none animate-in scale-in duration-200">
      <span className="text-[9px] text-[#0091ff] uppercase tracking-wider font-extrabold">Active State</span>
      <span className="text-base tracking-wide font-mono leading-tight">{data.label || "[Start]"}</span>
      <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Left} id="l" style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Top} id="t" style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ opacity: 0, width: 0, height: 0 }} />
    </div>
  );
}

function NeighborNode({ data }: { data: { label: string; onClick: () => void; probability: number; targetPosition: Position } }) {
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#0091ff]/25 to-[#00d2ff]/25 opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm" />
      <button
        onClick={data.onClick}
        className="relative px-3.5 py-2 rounded-xl border border-border/80 bg-background/95 text-foreground hover:bg-[#0091ff]/10 hover:border-[#0091ff]/40 transition-all font-mono font-bold shadow-md backdrop-blur-md cursor-pointer select-none text-xs active:scale-95 flex items-center gap-1.5 min-w-[85px] justify-center"
      >
        <span className="text-[#0091ff] font-extrabold font-mono">+{data.label}</span>
        <span className="text-[9px] text-muted-foreground font-sans font-semibold">({(data.probability * 100).toFixed(0)}%)</span>
        <Handle type="target" position={data.targetPosition} id="target" style={{ opacity: 0, width: 0, height: 0 }} />
      </button>
    </div>
  );
}

function EndNode({ data }: { data: { onClick: () => void; probability: number; targetPosition: Position } }) {
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-red-500/25 to-amber-500/25 opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm" />
      <button
        onClick={data.onClick}
        className="relative px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/5 text-red-500 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-all font-bold shadow-md backdrop-blur-md cursor-pointer select-none text-xs active:scale-95 flex items-center gap-1.5 min-w-[85px] justify-center"
      >
        <span>[End]</span>
        <span className="text-[9px] text-red-500/80 dark:text-red-400/80 font-sans font-semibold">({(data.probability * 100).toFixed(0)}%)</span>
        <Handle type="target" position={data.targetPosition} id="target" style={{ opacity: 0, width: 0, height: 0 }} />
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
  } else if (normalized >= Math.PI / 4 && normalized < 3 * Math.PI / 4) {
    return { sourceHandle: "b", targetPosition: Position.Top };
  } else if (normalized >= -3 * Math.PI / 4 && normalized < -Math.PI / 4) {
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

  // Roll randomly using probability distribution
  const handleRollRandom = () => {
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

  // Play pronunciation via SpeechSynthesis
  const handleSpeak = () => {
    if (!activePrefix || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(MarkovChain.capitalize(activePrefix));
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="relative border border-border/40 rounded-xl bg-card/40 backdrop-blur-md flex flex-col overflow-hidden">
      {/* Control panel bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/30 px-4 py-3 bg-secondary/5 gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0091ff] animate-pulse" />
          <h3 className="text-xs font-bold text-foreground tracking-wide uppercase">Markov Path Visualizer</h3>
        </div>

        {/* Input box showing active path */}
        <div className="flex items-center gap-2 flex-1 max-w-sm sm:justify-end">
          <span className="text-[10px] font-bold text-muted-foreground uppercase hidden sm:inline">Path:</span>
          <input
            type="text"
            value={activePrefix}
            onChange={(e) => onChangePrefix(e.target.value.toLowerCase())}
            placeholder="Type prefix or click nodes..."
            className="flex-1 sm:max-w-[200px] rounded-lg border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-mono text-foreground placeholder-muted-foreground focus:border-[#0091ff]/50 focus:outline-none"
          />
          
          <button
            onClick={handleSpeak}
            disabled={!activePrefix}
            className="p-1 rounded-md border border-border/60 bg-background/50 hover:bg-[#0091ff]/10 hover:border-[#0091ff]/40 text-muted-foreground hover:text-[#0091ff] transition-all disabled:opacity-40 cursor-pointer"
            title="Pronounce name"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRollRandom}
            className="flex items-center gap-1 rounded-lg border border-[#0091ff]/30 bg-[#0091ff]/5 hover:bg-[#0091ff]/10 text-xs font-semibold text-[#0091ff] px-2.5 py-1 transition-all cursor-pointer"
            title="Roll path randomly to end"
          >
            <Sparkles className="h-3 w-3" />
            <span>Roll Path</span>
          </button>
          
          <button
            onClick={() => onChangePrefix("")}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 hover:bg-secondary/40 text-xs font-semibold text-muted-foreground px-2.5 py-1 transition-all cursor-pointer"
            title="Reset path to start"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Flow Canvas */}
      <div className="h-[380px] w-full relative bg-secondary/5">
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
          <Controls showInteractive={false} className="!bg-background/80 !border-border/60 !shadow-md !rounded-lg" />
          <FlowFitViewController activePrefix={activePrefix} />
        </ReactFlow>
        
        {/* Help tip overlay */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-md bg-background/85 border border-border/40 px-2 py-1 text-[10px] text-muted-foreground select-none pointer-events-none shadow-sm backdrop-blur-sm">
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
