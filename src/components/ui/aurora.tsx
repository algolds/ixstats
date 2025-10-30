"use client";
import { cn } from "~/lib/utils";

interface AuroraProps {
  className?: string;
  children: React.ReactNode;
}

export function Aurora({ className, children }: AuroraProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="aurora-bg pointer-events-none absolute inset-0" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
