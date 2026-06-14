"use client";

import React, { useMemo } from "react";
import { cn } from "~/lib/utils";
import {
  // eslint-disable-next-line unused-imports/no-unused-imports
  Flag,
  // eslint-disable-next-line unused-imports/no-unused-imports
  TrendingUp,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Building2,
  Crown,
  Coins,
  Eye,
  Settings,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Globe,
  Navigation,
  ChevronRight,
  Zap,
  Factory,
  type LucideIcon,
} from "lucide-react";
import { type BuilderSection, BUILDER_SECTION_THEMES } from "../lib/builder-theme";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

interface BuilderSectionNavWidgetProps {
  activeSection: BuilderSection;
}

interface SubTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: (st: any) => boolean;
  onClick: (st: any) => void;
}

export function BuilderSectionNavWidget({ activeSection }: BuilderSectionNavWidgetProps) {
  const state = useBuilderContext();
  const theme = BUILDER_SECTION_THEMES[activeSection];

  const subTabs = useMemo<SubTabItem[]>(() => {
    switch (activeSection) {
      case "identity":
        // Contextual navigation for identity is now fully integrated into the hero mini nav
        return [];
      case "government":
        return [
          {
            id: "components",
            label: "Atomic Components",
            icon: Settings,
            isActive: (st) => st.builderState.activeGovernmentTab === "components",
            onClick: (st) =>
              st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "components" })),
          },
          {
            id: "structure",
            label: "Government Builder",
            icon: Crown,
            isActive: (st) => st.builderState.activeGovernmentTab === "structure",
            onClick: (st) =>
              st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "structure" })),
          },
          {
            id: "spending",
            label: "Spending Policies",
            icon: Coins,
            isActive: (st) => st.builderState.activeGovernmentTab === "spending",
            onClick: (st) =>
              st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "spending" })),
          },
          {
            id: "preview",
            label: "Structure Preview",
            icon: Eye,
            isActive: (st) => st.builderState.activeGovernmentTab === "preview",
            onClick: (st) =>
              st.setBuilderState((prev: any) => ({ ...prev, activeGovernmentTab: "preview" })),
          },
        ];
      case "economics":
        return [
          {
            id: "components",
            label: "Econ Components",
            icon: Zap,
            isActive: (st) => st.builderState.activeEconomicsTab === "components",
            onClick: (st) =>
              st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "components" })),
          },
          {
            id: "structure",
            label: "Econ Structure",
            icon: Factory,
            isActive: (st) => st.builderState.activeEconomicsTab === "structure",
            onClick: (st) =>
              st.setBuilderState((prev: any) => ({ ...prev, activeEconomicsTab: "structure" })),
          },
          // fiscal & per-economy preview removed; use global Preview step instead
        ];
      default:
        return [];
    }
  }, [activeSection]);

  if (subTabs.length === 0) return null;

  const sectionTitles: Record<BuilderSection, string> = {
    foundation: "Foundation",
    identity: "Identity",
    government: "Government",
    economics: "Economics",
    preview: "Preview",
    import: "Import",
  };

  const sectionTitle = sectionTitles[activeSection] || activeSection;

  // Derive contextual header background tint matching the section theme
  const headerBgClass =
    theme.accentColor === "teal"
      ? "bg-teal-500/10"
      : theme.accentColor === "cyan"
        ? "bg-cyan-500/10"
        : theme.accentColor === "green"
          ? "bg-green-500/10"
          : "bg-amber-500/10";

  // Derive active sub-step item styling matching the section theme
  const activeItemStyles =
    theme.accentColor === "teal"
      ? {
          bgClass: "bg-teal-500/10 border-teal-500/20 text-teal-400 font-bold",
          pingBg: "bg-teal-400",
          pingDot: "bg-teal-500",
        }
      : theme.accentColor === "cyan"
        ? {
            bgClass: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 font-bold",
            pingBg: "bg-cyan-400",
            pingDot: "bg-cyan-500",
          }
        : theme.accentColor === "green"
          ? {
              bgClass: "bg-green-500/10 border-green-500/20 text-emerald-400 font-bold",
              pingBg: "bg-emerald-400",
              pingDot: "bg-emerald-500",
            }
          : {
              bgClass: "bg-amber-500/10 border-amber-500/20 text-amber-400 font-bold",
              pingBg: "bg-amber-400",
              pingDot: "bg-amber-500",
            };

  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "w-56 overflow-hidden rounded-xl")}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      {/* Cutout tab header */}
      <div className={cn("relative px-3 pt-2.5 pb-4", headerBgClass)}>
        <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold">
          <Navigation className={cn("h-3.5 w-3.5", theme.text || "text-amber-400")} />
          <span>{sectionTitle} Navigation</span>
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>

      <CutoutCardContent className="space-y-1 p-3 pt-1">
        {subTabs.map((item, idx) => {
          const isActive = item.isActive(state);
          const Icon = item.icon;

          return (
            <button
              key={idx}
              onClick={() => item.onClick(state)}
              className={cn(
                "group flex w-full items-center justify-between rounded-md border border-transparent p-1.5 text-left transition-all duration-200",
                isActive
                  ? activeItemStyles.bgClass
                  : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    isActive
                      ? theme.text || "text-amber-400"
                      : "text-muted-foreground/60 group-hover:text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "truncate text-[10px] leading-none",
                    isActive ? "font-bold" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </div>

              <div className="flex items-center gap-1 pl-2">
                {isActive ? (
                  <span className="relative flex h-1.5 w-1.5">
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                        activeItemStyles.pingBg
                      )}
                    ></span>
                    <span
                      className={cn(
                        "relative inline-flex h-1.5 w-1.5 rounded-full",
                        activeItemStyles.pingDot
                      )}
                    ></span>
                  </span>
                ) : (
                  <ChevronRight className="text-muted-foreground h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>
            </button>
          );
        })}
      </CutoutCardContent>
    </CutoutCard>
  );
}
