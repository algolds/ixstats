"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Grid3x3, ShoppingCart, Download } from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";

const CARDS_SUB_TABS = [
  { id: "collection", href: "/vault/cards", label: "My Collection", icon: Grid3x3 },
  { id: "marketplace", href: "/vault/marketplace", label: "Marketplace", icon: ShoppingCart },
  { id: "import", href: "/vault/import", label: "NS Import", icon: Download },
];

export function CardsSubNav() {
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname.startsWith("/vault/cards")) return "collection";
    if (
      pathname.startsWith("/vault/marketplace") ||
      pathname.startsWith("/vault/acquire") ||
      pathname.startsWith("/vault/create") ||
      pathname.startsWith("/vault/packs") ||
      pathname.startsWith("/vault/trading") ||
      pathname.startsWith("/vault/market")
    )
      return "marketplace";
    if (pathname.startsWith("/vault/import")) return "import";
    return "collection";
  };

  const activeTab = getActiveTab();

  return (
    <div className="glass-surface glass-refraction border-border/50 relative flex gap-1 overflow-hidden rounded-xl border p-1 shadow-sm backdrop-blur-md dark:border-white/10">
      <motion.div
        className="absolute inset-y-1 rounded-lg bg-slate-200/60 dark:bg-white/8"
        layout
        layoutId="cards-sub-tab-indicator"
        style={{
          width: `${100 / CARDS_SUB_TABS.length}%`,
          left: `${(CARDS_SUB_TABS.findIndex((t) => t.id === activeTab) / CARDS_SUB_TABS.length) * 100}%`,
        }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
      />
      {CARDS_SUB_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={withBasePath(tab.href)}
            className={cn(
              "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-transparent px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors duration-205",
              isActive
                ? "font-bold text-amber-600 dark:text-amber-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
