"use client";
import { cn } from "../../lib/utils";

interface AuroraProps {
  className?: string;
  children: React.ReactNode;
}

export function Aurora({ className, children }: AuroraProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="aurora-bg absolute inset-0 pointer-events-none" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}