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
import { SoundHigh as Volume2, Undo as RotateCcw, HelpCircle } from "iconoir-react";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { speakBrowserNative } from "~/lib/onoma/browser-speech";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

// Custom node components for React Flow
function CenterNode({ data }: { data: { label: string } }) {
  return (
    <div className="text-label animate-in scale-in border-tint bg-tint/15 rounded-card shadow-floating flex min-w-[125px] flex-col items-center gap-0.5 border-2 px-5 py-3 text-center font-semibold duration-200 select-none">
      <span className="text-tint text-eyebrow">Active state</span>
      <span className="text-body font-mono leading-tight">{data.label || "[Start]"}</span>
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
      <Button
        variant="outline"
        size="sm"
        onClick={data.onClick}
        className="relative min-w-[85px] justify-center font-mono"
      >
        <span className="text-tint font-mono font-semibold">+{data.label}</span>
        <span className="text-label-secondary text-caption font-sans font-semibold">
          ({(data.probability * 100).toFixed(0)}%)
        </span>
        <Handle
          type="target"
          position={data.targetPosition}
          id="target"
          style={{ opacity: 0, width: 0, height: 0 }}
        />
      </Button>
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
      <Button
        variant="outline"
        size="sm"
        onClick={data.onClick}
        className="text-red relative min-w-[85px] justify-center"
      >
        <span>[End]</span>
        <span className="text-caption text-red/80 font-sans font-semibold">
          ({(data.probability * 100).toFixed(0)}%)
        </span>
        <Handle
          type="target"
          position={data.targetPosition}
          id="target"
          style={{ opacity: 0, width: 0, height: 0 }}
        />
      </Button>
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
    // oxlint-disable-next-line
  }, [activePrefix, fitView]);

  return null;
}

interface MarkovVisualizerProps {
  chain: MarkovChain;
  activePrefix: string;
  onChangePrefix: (newPrefix: string) => void;
  onCompleteName?: (completedName: string) => void;
}

function MarkovVisualizerInner({
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
    <div className="border-separator bg-surface rounded-row relative flex flex-col overflow-hidden border">
      <div className="border-separator bg-fill-4 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-tint h-2 w-2 animate-pulse rounded-full" />
          <h3 className="text-label text-subhead">Markov path visualizer</h3>
        </div>

        {/* Input box showing active path */}
        <div className="flex max-w-sm flex-1 items-center gap-2 sm:justify-end">
          <span className="text-label-secondary text-eyebrow hidden sm:inline">Path:</span>
          <Input
            type="text"
            value={activePrefix}
            onChange={(e) => onChangePrefix(e.target.value.toLowerCase())}
            placeholder="Type prefix or click nodes..."
            className="text-footnote flex-1 font-mono sm:max-w-[200px]"
          />

          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleSpeak}
            disabled={!activePrefix}

            title="Pronounce name"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDerivePath}
            className="justify-center"
            title="Derive remaining path to end"
          >
            <span>Derive path</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onChangePrefix("")}

            title="Reset path to start"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      <div className="bg-fill-4 relative h-[380px] w-full">
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
            className="!bg-surface !border-separator !rounded-control !shadow-card"
          />
          <FlowFitViewController activePrefix={activePrefix} />
        </ReactFlow>

        <div className="bg-surface border-separator text-label-secondary rounded-control-sm text-caption shadow-card pointer-events-none absolute right-3 bottom-3 z-20 flex items-center gap-1 border px-2 py-1 select-none">
          <HelpCircle className="text-tint/80 h-3 w-3" />
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
