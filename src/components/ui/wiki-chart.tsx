"use client";

import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { useTheme } from "~/context/theme-context";

// ponytail: theme source is the app's ThemeProvider (data-theme), not a per-chart
// MutationObserver. Colors are resolved hex because recharts sets stroke/fill as SVG
// attributes, where CSS var() does not resolve — that's why the dead useChartTheme()
// in theme-context (which returns var(...) strings) was never wired to anything.
export function useWikiChartColors() {
  const { effectiveTheme } = useTheme();
  const light = effectiveTheme === "light";
  const border = light ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  return {
    accent: light ? "#2563eb" : "#3b82f6",
    muted: light ? "#52525b" : "#a1a1aa",
    border,
    // Spread onto a recharts <Tooltip {...tooltipProps} />
    tooltipProps: {
      contentStyle: {
        background: light ? "#ffffff" : "#16181d",
        border: `1px solid ${border}`,
        borderRadius: "6px",
        color: light ? "#18181b" : "#e4e4e7",
      },
    },
  };
}

/** Sized, responsive wrapper for a single recharts chart. */
export function WikiChart({
  height = 192,
  children,
}: {
  height?: number;
  children: ReactElement;
}) {
  return (
    <div className="w-full text-[10px]" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
