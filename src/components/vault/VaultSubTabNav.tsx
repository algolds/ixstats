import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { FacetContainer } from "~/components/ui/facet-container";

export interface VaultTabConfig<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

export interface VaultSubTabNavProps<T extends string> {
  tabs: readonly VaultTabConfig<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  activeColor?: {
    text: string;
    bg: string;
    icon: string;
  };
  tabColors?: Record<string, { text: string; bg: string; icon: string }>;
  className?: string;
  maxWidthClass?: string;
  layoutId?: string;
}

export function VaultSubTabNav<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  activeColor = {
    text: "font-bold text-amber-600 dark:text-amber-400",
    bg: "bg-white/60 dark:bg-white/10 border-slate-200 dark:border-white/15 shadow-md backdrop-blur-md",
    icon: "text-amber-600 dark:text-amber-400",
  },
  tabColors,
  className,
  maxWidthClass = "sm:max-w-md",
  layoutId = "vault-subtab-indicator",
}: VaultSubTabNavProps<T>) {
  const activeIdx = tabs.findIndex((t) => t.id === activeTab);
  const currentTabColor = tabColors?.[activeTab] || activeColor;

  return (
    <FacetContainer
      depth={2}
      className={cn(
        "relative flex w-full gap-1 overflow-hidden rounded-2xl p-1.5 shadow-lg backdrop-blur-2xl",
        maxWidthClass,
        className
      )}
    >
      <motion.div
        className={cn(
          "absolute inset-y-1.5 rounded-xl border transition-colors duration-200",
          currentTabColor.bg
        )}
        layout
        layoutId={layoutId}
        style={{
          width: `calc(${100 / tabs.length}% - 0.25rem)`,
          left: `calc(${(activeIdx / tabs.length) * 100}% + 0.125rem)`,
        }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
      />
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const configColor = tabColors?.[tab.id] || activeColor;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-transparent px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-150 active:scale-95",
              isActive
                ? cn(configColor.text, "font-bold drop-shadow-sm")
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "h-3.5 w-3.5 transition-colors duration-150",
                  isActive ? configColor.icon : "text-muted-foreground"
                )}
              />
            )}
            <span>{tab.label}</span>
            {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
              <span className="ml-1 animate-pulse rounded-full border border-blue-400/40 bg-blue-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white tabular-nums shadow-sm backdrop-blur-md">
                {tab.badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </FacetContainer>
  );
}
