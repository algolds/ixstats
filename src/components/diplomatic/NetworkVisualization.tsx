"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Network Visualization Component
 *
 * Interactive force-directed graph showing diplomatic network
 * Uses HTML5 Canvas for performance with many nodes
 * Features:
 * - Force-directed layout simulation
 * - Interactive zoom/pan
 * - Node clustering by relationship type
 * - Real-time data flows visualization
 * - Detailed tooltips on hover
 */

interface Node {
  id: string;
  name: string;
  type: "self" | "ally" | "trade" | "neutral" | "tension";
  size: number; // GDP-based
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number; // Fixed position
  fy?: number;
  color: string;
  data?: any;
}

interface Edge {
  source: string;
  target: string;
  strength: number; // 0-100
  type: "alliance" | "trade" | "neutral" | "tension";
  thickness: number;
  color: string;
  animated?: boolean;
}

interface NetworkVisualizationProps {
  countryId: string;
  countryName: string;
  embassies: any[];
  relationships: any[];
  width?: number;
  height?: number;
  showDataFlows?: boolean;
  filterType?: "all" | "alliance" | "trade" | "cultural";
}

export default function NetworkVisualization({
  countryId,
  countryName,
  embassies,
  relationships,
  width = 800,
  height = 600,
  showDataFlows = true,
  filterType = "all",
}: NetworkVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);

  // Build network graph data
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Add self node (center)
    nodes.push({
      id: countryId,
      name: countryName,
      type: "self",
      size: 40,
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      fx: width / 2, // Fix self at center
      fy: height / 2,
      color: "#fbbf24", // Gold
    });

    // Add relationship nodes
    relationships.forEach((rel, idx) => {
      const angle = (idx / relationships.length) * Math.PI * 2;
      const radius = 200;

      const relationshipType = (rel.relationship ?? "neutral").toString().toLowerCase();
      const nodeType: Node["type"] =
        relationshipType === "alliance" || relationshipType === "friendly"
          ? "ally"
          : relationshipType === "trade"
            ? "trade"
            : relationshipType === "tension" || relationshipType === "hostile"
              ? "tension"
              : "neutral";

      const edgeType: Edge["type"] =
        relationshipType === "alliance" || relationshipType === "friendly"
          ? "alliance"
          : relationshipType === "trade"
            ? "trade"
            : relationshipType === "tension" || relationshipType === "hostile"
              ? "tension"
              : "neutral";

      const nodeColor =
        edgeType === "alliance"
          ? "#10b981" // Green
          : edgeType === "trade"
            ? "#3b82f6" // Blue
            : edgeType === "tension"
              ? "#ef4444" // Red
              : "#6b7280"; // Gray

      nodes.push({
        id: rel.targetCountryId,
        name: rel.targetCountry || "Unknown",
        type: nodeType,
        size: 20 + rel.strength / 5, // Size based on relationship strength
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        color: nodeColor,
        data: rel,
      });

      // Add edge
      edges.push({
        source: countryId,
        target: rel.targetCountryId,
        strength: rel.strength,
        type: edgeType,
        thickness: 1 + rel.strength / 25,
        color: nodeColor,
        animated: showDataFlows && rel.strength >= 60,
      });
    });

    return { nodes, edges };
  }, [countryId, countryName, relationships, width, height, showDataFlows]);

  // Force simulation
  useEffect(() => {
    const simulate = () => {
      nodes.forEach((node, i) => {
        if (node.fx !== undefined && node.fy !== undefined) {
          node.x = node.fx;
          node.y = node.fy;
          return; // Skip fixed nodes
        }

        // Repulsion from other nodes
        nodes.forEach((other, j) => {
          if (i === j) return;
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const repulsion = 1000 / (distance * distance);
          node.vx -= (dx / distance) * repulsion;
          node.vy -= (dy / distance) * repulsion;
        });

        // Attraction along edges
        edges.forEach((edge) => {
          if (edge.source === node.id) {
            const target = nodes.find((n) => n.id === edge.target);
            if (target) {
              const dx = target.x - node.x;
              const dy = target.y - node.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const attraction = (distance - 100) * 0.01;
              node.vx += dx * attraction;
              node.vy += dy * attraction;
            }
          }
        });

        // Apply velocity with damping
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;

        // Boundary constraints
        const margin = node.size;
        node.x = Math.max(margin, Math.min(width - margin, node.x));
        node.y = Math.max(margin, Math.min(height - margin, node.y));
      });

      drawNetwork();
      animationFrameRef.current = requestAnimationFrame(simulate);
    };

    animationFrameRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [nodes, edges, width, height]);

  // Draw network on canvas
  const drawNetwork = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Apply transform
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Draw edges
    edges.forEach((edge) => {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = edge.color;
      ctx.lineWidth = edge.thickness;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Animated data flow particles
      if (edge.animated) {
        const progress = (Date.now() % 2000) / 2000;
        const x = source.x + (target.x - source.x) * progress;
        const y = source.y + (target.y - source.y) * progress;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = edge.color;
        ctx.fill();
      }
    });

    // Draw nodes
    nodes.forEach((node) => {
      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glow effect for hovered/selected
      if (hoveredNode?.id === node.id || selectedNode?.id === node.id) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + 5, 0, Math.PI * 2);
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Label
      ctx.fillStyle = "#ffffff";
      ctx.font = node.type === "self" ? "bold 14px sans-serif" : "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.name, node.x, node.y - node.size - 10);
    });

    ctx.restore();
  };

  // Mouse interaction handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: prev.x + (e.clientX - dragStart.x),
        y: prev.y + (e.clientY - dragStart.y),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Check for node hover
    const hovered = nodes.find((node) => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= node.size;
    });

    setHoveredNode(hovered || null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    // Check for node click
    const clicked = nodes.find((node) => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= node.size;
    });

    if (clicked) {
      setSelectedNode(clicked);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale * delta)),
    }));
  };

  return (
    <div className="relative">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-move rounded-lg border border-white/10 bg-black/20"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredNode && hoveredNode.type !== "self" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-4 right-4 max-w-xs rounded-lg border border-white/20 bg-black/90 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: hoveredNode.color }}
              />
              <h4 className="text-sm font-semibold text-white">{hoveredNode.name}</h4>
            </div>
            {hoveredNode.data && (
              <div className="space-y-1 text-xs text-white/70">
                <p>
                  Relationship: <span className="text-white">{hoveredNode.data.relationship}</span>
                </p>
                <p>
                  Strength: <span className="text-white">{hoveredNode.data.strength}%</span>
                </p>
                {hoveredNode.data.tradeVolume && (
                  <p>
                    Trade:{" "}
                    <span className="text-white">
                      ${(hoveredNode.data.tradeVolume / 1000000).toFixed(1)}M
                    </span>
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 flex gap-2">
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="rounded border border-white/20 bg-black/90 px-3 py-1.5 text-xs text-white backdrop-blur-xl transition-colors hover:bg-white/10"
        >
          Reset View
        </button>
        <button
          onClick={() =>
            setTransform((prev) => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))
          }
          className="rounded border border-white/20 bg-black/90 px-3 py-1.5 text-xs text-white backdrop-blur-xl transition-colors hover:bg-white/10"
        >
          Zoom In
        </button>
        <button
          onClick={() =>
            setTransform((prev) => ({ ...prev, scale: Math.max(0.5, prev.scale * 0.8) }))
          }
          className="rounded border border-white/20 bg-black/90 px-3 py-1.5 text-xs text-white backdrop-blur-xl transition-colors hover:bg-white/10"
        >
          Zoom Out
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 rounded-lg border border-white/20 bg-black/90 p-3 shadow-2xl backdrop-blur-xl">
        <h4 className="mb-2 text-xs font-semibold text-white">Legend</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-white/70">Your Country</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-white/70">Alliance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-white/70">Trade Partner</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-500" />
            <span className="text-white/70">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-white/70">Tension</span>
          </div>
        </div>
      </div>
    </div>
  );
}
