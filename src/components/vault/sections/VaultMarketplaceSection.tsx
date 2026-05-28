"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Store, ShoppingCart, ArrowRightLeft } from "lucide-react";
import { cn } from "~/lib/utils";
import { VaultStoreTab } from "./marketplace/VaultStoreTab";
import { VaultAuctionsTab } from "./marketplace/VaultAuctionsTab";
import { VaultTradingTab } from "./marketplace/VaultTradingTab";

type SubTab = "store" | "auctions" | "trading";

const SUB_TABS = [
  { id: "store" as SubTab, label: "Vault Shop", icon: Store },
  { id: "auctions" as SubTab, label: "Auctions", icon: ShoppingCart },
  { id: "trading" as SubTab, label: "Trading", icon: ArrowRightLeft },
];

interface VaultMarketplaceSectionProps {
  initialTab?: string | null;
}

function resolveInitialTab(tab: string | null | undefined): SubTab {
  if (tab === "auctions") return "auctions";
  if (tab === "trading") return "trading";
  return "store";
}

export function VaultMarketplaceSection({ initialTab }: VaultMarketplaceSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>(() => resolveInitialTab(initialTab));

  const handleTabChange = (tab: SubTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState({}, "", url.toString());
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="glass-surface glass-refraction border-border/40 relative flex gap-1 overflow-hidden rounded-xl border p-1 shadow-sm backdrop-blur-md">
        <motion.div
          className="absolute inset-y-1 rounded-lg bg-slate-200/60 dark:bg-white/8"
          layout
          layoutId="marketplace-tab-indicator"
          style={{
            width: `${100 / SUB_TABS.length}%`,
            left: `${(SUB_TABS.findIndex((t) => t.id === activeTab) / SUB_TABS.length) * 100}%`,
          }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-transparent px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors duration-205",
                isActive
                  ? "font-bold text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 transition-colors duration-205",
                  isActive && "text-amber-500"
                )}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="outline-none"
        >
          {activeTab === "store" && <VaultStoreTab />}
          {activeTab === "auctions" && <VaultAuctionsTab />}
          {activeTab === "trading" && <VaultTradingTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
