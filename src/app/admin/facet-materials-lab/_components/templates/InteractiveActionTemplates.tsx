import * as React from "react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils";
import {
  Sparks as Sparkles,
  Shield,
  Activity,
  StatsReport as BarChart3,
  Heart,
  Flash as Zap,
  Bell,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { type LabConfig } from "../types";

interface ActionTemplateProps {
  config: LabConfig;
  previewRef: React.RefObject<HTMLDivElement | null>;
  dynamicStyles: React.CSSProperties;
  generatedClassNames: string;
  accentVars: React.CSSProperties;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  buttonClickCount: number;
  setButtonClickCount: React.Dispatch<React.SetStateAction<number>>;
  glassClickStates: Record<string, boolean>;
  setGlassClickStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function InteractiveActionTemplates({
  config,
  previewRef,
  dynamicStyles,
  generatedClassNames,
  accentVars,
  activeNav,
  setActiveNav,
  buttonClickCount,
  setButtonClickCount,
  glassClickStates,
  setGlassClickStates,
}: ActionTemplateProps) {
  const { template, material, texture, textureOpacity, depth, customAccent } = config;

  switch (template) {
    case "facet-button":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex cursor-pointer items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold tracking-wide select-none"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10 flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 animate-pulse" style={{ color: customAccent }} />
            <span>Simulate Trigger Command</span>
          </div>
        </div>
      );

    case "facet-navigation":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-4 p-4")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-auto relative z-10 flex items-center justify-between">
            <div className="pointer-events-none flex items-center gap-2">
              <Shield className="h-4 w-4" style={{ color: customAccent }} />
              <span className="text-sm font-bold">IxStats</span>
            </div>
            <div className="relative z-20 flex items-center gap-3">
              {["Dashboard", "Analytics", "Settings"].map((item) => (
                <span
                  key={item}
                  onClick={() => setActiveNav(item)}
                  className={cn(
                    "cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold transition-all",
                    activeNav === item
                      ? "text-foreground bg-white/10 font-bold shadow-xs dark:bg-black/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-black/10"
                  )}
                  style={{
                    color: activeNav === item ? customAccent : undefined,
                  }}
                >
                  {item}
                </span>
              ))}
              <div
                onClick={() => setButtonClickCount((c) => c + 1)}
                className="ml-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[10px] font-bold text-white transition-transform active:scale-95"
                style={{ backgroundColor: customAccent }}
                title={`Profile clicked ${buttonClickCount} times`}
              >
                {buttonClickCount > 0 ? buttonClickCount : "A"}
              </div>
            </div>
          </div>
        </div>
      );

    case "health-rings":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-5 p-6 text-center")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <h4 className="text-sm font-bold">National Vitality</h4>
            <p className="text-muted-foreground text-[10px]">
              {material} · depth {depth}
            </p>
          </div>
          <div className="pointer-events-none relative z-10 flex items-center justify-center gap-4">
            {[
              { label: "Econ", value: 87, color: "#10b981" },
              { label: "Pop", value: 64, color: "#3b82f6" },
              { label: "Diplo", value: 92, color: "#8b5cf6" },
              { label: "Gov", value: 71, color: "#f59e0b" },
            ].map((ring) => {
              const circumference = 2 * Math.PI * 28;
              const offset = circumference - (ring.value / 100) * circumference;
              return (
                <div key={ring.label} className="flex flex-col items-center gap-1.5">
                  <svg width="72" height="72" className="-rotate-90">
                    <circle
                      cx="36"
                      cy="36"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      className="text-border"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r="28"
                      fill="none"
                      stroke={ring.color}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <span className="font-mono text-xs font-bold" style={{ color: ring.color }}>
                    {ring.value}%
                  </span>
                  <span className="text-muted-foreground text-[8px] font-semibold tracking-wider uppercase">
                    {ring.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "glass-button":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-4 p-6 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <h4 className="text-sm font-bold">Glass Button Variants</h4>
            <p className="text-muted-foreground text-[10px]">
              {material} ·{" "}
              {depth === 1 ? "shallow" : depth === 2 ? "medium" : depth === 3 ? "deep" : "modal"}{" "}
              depth
            </p>
          </div>
          <div className="pointer-events-auto relative z-10 flex flex-col gap-2">
            {[
              { label: "Primary Action", color: customAccent },
              { label: "Secondary", color: "#3b82f6" },
              { label: "Neutral", color: "#6b7280" },
              { label: "Danger", color: "#ef4444" },
            ].map((btn) => {
              const isClicked = glassClickStates[btn.label] || false;
              return (
                <button
                  key={btn.label}
                  onClick={() =>
                    setGlassClickStates((prev) => ({ ...prev, [btn.label]: !isClicked }))
                  }
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold tracking-wide backdrop-blur-sm transition-all hover:opacity-90 active:scale-98"
                  style={{
                    backgroundColor: isClicked ? `${btn.color}33` : `${btn.color}18`,
                    borderColor: isClicked ? btn.color : `${btn.color}30`,
                    color: btn.color,
                    boxShadow: isClicked
                      ? `inset 0 1px 0 ${btn.color}40, 0 0 12px ${btn.color}25`
                      : `inset 0 1px 0 ${btn.color}20, 0 4px 12px ${btn.color}10`,
                  }}
                >
                  <Zap className={cn("h-3.5 w-3.5", isClicked && "fill-current")} />
                  {btn.label} {isClicked && "✓"}
                </button>
              );
            })}
          </div>
        </div>
      );

    case "brand-header":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex w-full flex-col gap-4 overflow-hidden p-6 text-center"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div
            className="pointer-events-none absolute -top-8 left-1/2 z-0 h-24 w-3/4 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
            style={{ backgroundColor: customAccent }}
          />
          <div className="pointer-events-none relative z-10 mt-4 flex flex-col items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: `${customAccent}20`,
                boxShadow: `0 0 30px ${customAccent}20`,
              }}
            >
              <Shield className="h-7 w-7" style={{ color: customAccent }} />
            </div>
            <h3
              className="bg-clip-text text-2xl font-black tracking-tight text-transparent"
              style={{
                backgroundImage: `linear-gradient(to bottom, ${customAccent}, ${customAccent}99)`,
              }}
            >
              IxStats
            </h3>
            <p className="text-muted-foreground max-w-[240px] text-[10px] leading-relaxed">
              Next-generation nation simulation platform with real-time analytics and diplomatic
              intelligence.
            </p>
          </div>
          <div className="pointer-events-none relative z-10 flex items-center justify-center gap-3">
            <div
              className="rounded-lg px-4 py-2 text-[10px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: customAccent }}
            >
              Get Started
            </div>
            <div
              className="rounded-lg border px-4 py-2 text-[10px] font-bold transition-colors"
              style={{ borderColor: `${customAccent}40`, color: customAccent }}
            >
              Learn More
            </div>
          </div>
        </div>
      );

    case "gradient-metrics":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-4 p-6 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <h3
              className="bg-clip-text text-lg font-black tracking-tight text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, ${customAccent}, ${customAccent}bb, ${customAccent}66)`,
              }}
            >
              System Overview
            </h3>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              Real-time performance with {material} surface
            </p>
          </div>
          <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-3">
            {[
              { label: "CPU Usage", value: "64%", sub: "8 cores", icon: Activity },
              { label: "Memory", value: "4.2 GB", sub: "16 GB total", icon: BarChart3 },
              { label: "Requests", value: "1,847", sub: "/min", icon: Heart },
              { label: "Latency", value: "42ms", sub: "p99", icon: Bell },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="rounded-xl border p-3"
                  style={{ borderColor: `${customAccent}15` }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3 w-3" style={{ color: customAccent }} />
                    <span className="text-muted-foreground text-[8px] font-semibold tracking-wider uppercase">
                      {metric.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold">{metric.value}</span>
                    <span className="text-muted-foreground font-mono text-[9px]">{metric.sub}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="pointer-events-none relative z-10 flex items-center justify-between border-t pt-3"
            style={{ borderColor: `${customAccent}10` }}
          >
            <span className="text-muted-foreground text-[9px]">Last updated 2m ago</span>
            <ChevronRight className="text-muted-foreground h-3 w-3" />
          </div>
        </div>
      );

    default:
      return null;
  }
}
