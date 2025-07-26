"use client";

import React, { useState } from "react";
import { Reorder } from "framer-motion";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { GlassCard } from "./enhanced-card";
import { Button } from "./button";
import { cn } from "../../lib/utils";

interface SortableCardProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  variant?: "glass" | "diplomatic" | "military" | "economic" | "social" | "mycountry";
  actions?: React.ReactNode;
  order: number;
  onReorder?: (newOrder: number) => void;
}

export function SortableCard({
  id,
  title,
  icon,
  children,
  defaultOpen = true,
  className = "",
  variant = "glass",
  actions,
  order,
  onReorder
}: SortableCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Reorder.Item
      value={{ id, order }}
      onDrag={() => {}}
      className={cn("group cursor-grab active:cursor-grabbing", className)}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        zIndex: 50,
      }}
      transition={{
        type: "spring",
        damping: 25,
        stiffness: 300
      }}
    >
      <GlassCard 
        variant={variant} 
        className="relative overflow-hidden backdrop-blur-xl bg-card/80 border border-white/20 dark:border-white/10 shadow-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        {/* Glow effect overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 blur-xl animate-pulse" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
        </div>

        <div className="relative z-10">
          <div className="p-4 border-b border-border/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                {icon}
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {actions}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(!isOpen)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-white/10"
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          {isOpen && (
            <div className="p-4 backdrop-blur-sm">
              {children}
            </div>
          )}
        </div>

        {/* Subtle refraction effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-white/20 to-transparent" />
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        </div>
      </GlassCard>
    </Reorder.Item>
  );
}

interface SortableGridProps {
  children: React.ReactNode;
  onReorder?: (newOrder: any[]) => void;
  className?: string;
}

export function SortableGrid({ children, onReorder, className }: SortableGridProps) {
  const [items, setItems] = React.useState([
    { id: "mycountry", order: 0 },
    { id: "global", order: 1 },
    { id: "eci", order: 2 },
    { id: "sdi", order: 3 },
  ]);

  const handleReorder = (newItems: any[]) => {
    setItems(newItems);
    onReorder?.(newItems);
  };

  return (
    <Reorder.Group
      as="div"
      values={items}
      onReorder={handleReorder}
      className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6", className)}
    >
      {children}
    </Reorder.Group>
  );
}