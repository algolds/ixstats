"use client";

import React, { useMemo } from "react";
import { cn } from "~/lib/utils";
import {
  Globe,
  Flag,
  Building2,
  TrendingUp,
  CheckCircle,
  Lock,
  Check,
  Sparkles,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { type BuilderSection } from "../lib/builder-theme";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

interface BuilderSidebarNavProps {
  activeSection: BuilderSection;
  onNavigate: (section: BuilderSection) => void;
  completedSteps?: Set<BuilderSection>;
  accessibleSteps?: Set<BuilderSection>;
  variant?: "desktop" | "expanded" | "mobile";
  mode?: "create" | "edit";
}

interface NavItem {
  title: string;
  section: BuilderSection;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  tab?: string;
  isActive: (activeSec: BuilderSection, state: any) => boolean;
  onClick: (state: any, onNavigate: (section: BuilderSection) => void) => void;
}

export function BuilderSidebarNav({
  activeSection,
  onNavigate,
  completedSteps = new Set(),
  accessibleSteps,
  variant = "desktop",
  mode = "create",
}: BuilderSidebarNavProps) {
  const state = useBuilderContext();

  const isAccessible = (section: BuilderSection) => {
    if (!accessibleSteps) return true;
    return accessibleSteps.has(section);
  };

  // Define steps for Create Mode
  const createNavItems = useMemo<NavItem[]>(
    () => [
      {
        title: "Foundation",
        section: "foundation",
        icon: Globe,
        colorClass: "text-blue-400",
        bgClass: "bg-blue-500/5 hover:bg-blue-500/10",
        isActive: (sec) => sec === "foundation",
        onClick: (_, onNav) => onNav("foundation"),
      },
      {
        title: "Core Identity",
        section: "identity",
        icon: Flag,
        colorClass: "text-teal-400",
        bgClass: "bg-teal-500/5 hover:bg-teal-500/10",
        isActive: (sec) => sec === "identity",
        onClick: (_, onNav) => onNav("identity"),
      },
      {
        title: "Preview & Create",
        section: "preview",
        icon: CheckCircle,
        colorClass: "text-amber-400",
        bgClass: "bg-amber-500/5 hover:bg-amber-500/10",
        isActive: (sec) => sec === "preview",
        onClick: (_, onNav) => onNav("preview"),
      },
    ],
    []
  );

  // Define steps for Edit Mode
  const editNavItems = useMemo<NavItem[]>(
    () => [
      {
        title: "National Identity",
        section: "identity",
        icon: Flag,
        colorClass: "text-teal-400",
        bgClass: "bg-teal-500/5 hover:bg-teal-500/10",
        tab: "identity",
        isActive: (sec, st) => sec === "identity" && st.builderState.activeCoreTab === "identity",
        onClick: (st, onNav) => {
          st.setBuilderState((prev: any) => ({ ...prev, activeCoreTab: "identity" }));
          onNav("identity");
        },
      },
      {
        title: "Core Indicators",
        section: "identity",
        icon: TrendingUp,
        colorClass: "text-emerald-400",
        bgClass: "bg-emerald-500/5 hover:bg-emerald-500/10",
        tab: "indicators",
        isActive: (sec, st) => sec === "identity" && st.builderState.activeCoreTab === "indicators",
        onClick: (st, onNav) => {
          st.setBuilderState((prev: any) => ({ ...prev, activeCoreTab: "indicators" }));
          onNav("identity");
        },
      },
      {
        title: "Gov Components",
        section: "government",
        icon: Building2,
        colorClass: "text-cyan-400",
        bgClass: "bg-cyan-500/5 hover:bg-cyan-500/10",
        tab: "components",
        isActive: (sec, st) =>
          sec === "government" && st.builderState.activeGovernmentTab === "components",
        onClick: (st, onNav) => {
          st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "components" }));
          onNav("government");
        },
      },
      {
        title: "Gov Structure",
        section: "government",
        icon: Building2,
        colorClass: "text-sky-400",
        bgClass: "bg-sky-500/5 hover:bg-sky-500/10",
        tab: "structure",
        isActive: (sec, st) =>
          sec === "government" && st.builderState.activeGovernmentTab === "structure",
        onClick: (st, onNav) => {
          st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "structure" }));
          onNav("government");
        },
      },
      {
        title: "Spending Policies",
        section: "government",
        icon: Building2,
        colorClass: "text-blue-400",
        bgClass: "bg-blue-500/5 hover:bg-blue-500/10",
        tab: "spending",
        isActive: (sec, st) =>
          sec === "government" && st.builderState.activeGovernmentTab === "spending",
        onClick: (st, onNav) => {
          st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "spending" }));
          onNav("government");
        },
      },
      {
        title: "Tax System",
        section: "economics",
        icon: TrendingUp,
        colorClass: "text-purple-400",
        bgClass: "bg-purple-500/5 hover:bg-purple-500/10",
        tab: "tax",
        isActive: (sec, st) =>
          sec === "economics" &&
          (st.builderState.activeEconomicsTab === "tax" ||
            st.builderState.activeEconomicsTab === "taxes"),
        onClick: (st, onNav) => {
          st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "tax" }));
          onNav("economics");
        },
      },
      {
        title: "Economy Sectors",
        section: "economics",
        icon: Globe,
        colorClass: "text-violet-400",
        bgClass: "bg-violet-500/5 hover:bg-violet-500/10",
        tab: "economy",
        isActive: (sec, st) =>
          sec === "economics" &&
          (st.builderState.activeEconomicsTab === "economy" ||
            st.builderState.activeEconomicsTab === "sectors" ||
            st.builderState.activeEconomicsTab === "components" ||
            st.builderState.activeEconomicsTab === "labor" ||
            st.builderState.activeEconomicsTab === "demographics" ||
            st.builderState.activeEconomicsTab === "preview"),
        onClick: (st, onNav) => {
          st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "economy" }));
          onNav("economics");
        },
      },
      {
        title: "Preview & Save",
        section: "preview",
        icon: CheckCircle,
        colorClass: "text-amber-400",
        bgClass: "bg-amber-500/5 hover:bg-amber-500/10",
        isActive: (sec) => sec === "preview",
        onClick: (_, onNav) => onNav("preview"),
      },
    ],
    []
  );

  const activeItems = mode === "edit" ? editNavItems : createNavItems;

  // Calculate completion percentage
  const completionPercent = useMemo(() => {
    if (mode === "edit") {
      // In edit mode, look at how many of the 3 primary sections are completed (identity, government, economics)
      const editSections: BuilderSection[] = ["identity", "government", "economics"];
      const completed = editSections.filter((s) => completedSteps.has(s)).length;
      return Math.round((completed / editSections.length) * 100);
    } else {
      // Create mode
      const createSections: BuilderSection[] = ["foundation", "identity"];
      const completed = createSections.filter((s) => completedSteps.has(s)).length;
      return Math.round((completed / createSections.length) * 100);
    }
  }, [completedSteps, mode]);

  // ─── Mobile: horizontal pill bar ───
  if (variant === "mobile") {
    return (
      <nav className="glass-surface glass-refraction overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 p-1.5 backdrop-blur-md">
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
          {activeItems.map((item, idx) => {
            const isActive = item.isActive(activeSection, state);
            const accessible = isAccessible(item.section);
            const completed = completedSteps.has(item.section);

            return (
              <button
                key={idx}
                onClick={() => accessible && item.onClick(state, onNavigate)}
                disabled={!accessible}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-[10px] font-semibold transition-all duration-200",
                  isActive
                    ? "bg-amber-500 font-bold text-zinc-950 shadow-md"
                    : accessible
                      ? "border-zinc-800/40 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                      : "cursor-not-allowed text-zinc-600"
                )}
              >
                <item.icon
                  size={10}
                  className={cn("shrink-0", isActive ? "text-zinc-950" : item.colorClass)}
                />
                <span>{item.title}</span>
                {!accessible && <Lock className="h-2.5 w-2.5 shrink-0 text-zinc-600" />}
                {completed && !isActive && (
                  <Check className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ─── Desktop: CutoutCard Step Progress Widget ───
  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "w-56 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40 shadow-lg backdrop-blur-md"
      )}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      {/* Cutout Header */}
      <div className="relative bg-amber-500/10 px-3 pt-2.5 pb-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>{mode === "edit" ? "Edit Progress" : "Build Progress"}</span>
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>

      <CutoutCardContent className="space-y-3.5 p-3 pt-1">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] text-zinc-400">
            <span>Overall Completion</span>
            <span className="font-bold text-zinc-200">{completionPercent}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-1">
          {activeItems.map((item, idx) => {
            const isActive = item.isActive(activeSection, state);
            const accessible = isAccessible(item.section);
            const completed = completedSteps.has(item.section);
            const Icon = item.icon;

            return (
              <button
                key={idx}
                onClick={() => accessible && item.onClick(state, onNavigate)}
                disabled={!accessible}
                className={cn(
                  "group flex w-full items-center justify-between rounded-md border border-transparent p-1.5 text-left transition-all duration-200",
                  isActive
                    ? "border-amber-500/20 bg-amber-500/10 font-bold"
                    : accessible
                      ? cn("text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200", item.bgClass)
                      : "cursor-not-allowed text-zinc-600 opacity-60"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors",
                      isActive ? "text-amber-400" : accessible ? item.colorClass : "text-zinc-700"
                    )}
                  />
                  <span
                    className={cn(
                      "truncate text-[10px] leading-none",
                      isActive ? "font-bold text-amber-400" : "text-zinc-300"
                    )}
                  >
                    {item.title}
                  </span>
                </div>

                <div className="flex items-center gap-1 pl-2">
                  {!accessible ? (
                    <Lock className="h-3 w-3 text-zinc-700" />
                  ) : completed && !isActive ? (
                    <Check className="h-3 w-3 stroke-[2.5] text-emerald-500" />
                  ) : isActive ? (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                    </span>
                  ) : (
                    <ChevronRight className="h-3 w-3 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
