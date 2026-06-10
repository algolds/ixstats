"use client";

import React from "react";
import { ChevronRight } from "lucide-react";

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onClick?: () => void;
}

export function StatCard({ icon: Icon, label, value, onClick }: StatCardProps) {
  const interactive = !!onClick;
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bg-muted rounded-lg px-3 py-2 text-left ${
        interactive
          ? "hover:bg-accent cursor-pointer transition-colors hover:ring-1 hover:ring-blue-300/50 active:scale-[0.98]"
          : ""
      }`}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
        <Icon className="h-3 w-3" />
        {label}
        {interactive && <ChevronRight className="ml-auto h-2.5 w-2.5 opacity-40" />}
      </div>
      <div className="text-foreground mt-0.5 text-sm font-semibold">{value}</div>
    </Tag>
  );
}
