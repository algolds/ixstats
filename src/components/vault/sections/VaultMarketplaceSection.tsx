"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shop as Store,
  Cart as ShoppingCart,
  ArrowSeparate as ArrowRightLeft,
} from "iconoir-react";
import { VaultSubTabNav } from "~/components/vault/VaultSubTabNav";
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
      <VaultSubTabNav
        tabs={SUB_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        maxWidthClass="w-full"
        layoutId="marketplace-tab-indicator"
      />

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
