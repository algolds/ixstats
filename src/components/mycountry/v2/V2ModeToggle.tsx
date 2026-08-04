"use client";

import { LayoutGrid, Command } from "lucide-react";
import { cn } from "~/lib/utils";

export type V2Mode = "home" | "console";

/**
 * The two v2 operating modes (migration §2):
 *  - HOME — the action command surface (briefing + feed + rail)
 *  - CONSOLE (Executive) — the Intent/declaration surface
 * Rendered as a single segmented toggle; no sidebar, one-click to switch.
 */
export function V2ModeToggle({
  mode,
  onChange,
}: {
  mode: V2Mode;
  onChange: (mode: V2Mode) => void;
}) {
  const options: { id: V2Mode; label: string; icon: typeof LayoutGrid }[] = [
    { id: "home", label: "Home", icon: LayoutGrid },
    { id: "console", label: "Declare a Directive", icon: Command },
  ];

  return (
    <div className="border-border/60 bg-card/50 flex w-fit items-center gap-1 rounded-xl border p-1 backdrop-blur-md">
      {options.map(({ id, label, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
              active
                ? "bg-amber-500/15 text-amber-500 shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}