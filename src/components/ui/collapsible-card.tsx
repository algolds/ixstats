"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { GlassCard } from "./enhanced-card";
import { Button } from "./button";

interface CollapsibleCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  variant?: "glass" | "diplomatic" | "military" | "economic" | "social";
  actions?: React.ReactNode;
}

export function CollapsibleCard({
  title,
  icon,
  children,
  defaultOpen = true,
  className = "",
  variant = "glass",
  actions,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <GlassCard variant={variant} className={`${className}`}>
      <div className="border/10 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="h-8 w-8 p-0"
            >
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
      {isOpen && <div className="p-4">{children}</div>}
    </GlassCard>
  );
}
