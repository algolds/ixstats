"use client";

import React from "react";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { cn } from "~/lib/utils";

interface VaultBackgroundProps {
  children?: React.ReactNode;
  className?: string;
}

export function VaultBackground({
  children,
  className,
}: VaultBackgroundProps) {
  return (
    <div className={cn("bg-background relative min-h-screen", className)}>
      {/* Standard IxStats Interactive Grid Background - EXACT same as other pages */}
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="fixed inset-0 z-0 opacity-30 dark:opacity-20"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />

      {/* Content wrapper */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
