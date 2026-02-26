"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Coins } from "lucide-react";
import { useUser } from "~/context/auth-context";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { api } from "~/trpc/react";
import { VaultSidebarLayout } from "./VaultSidebarLayout";
import { getSectionFromPathname, getSubTabFromPathname, type VaultSection } from "./VaultSidebarNav";
import { VaultDashboardSection } from "./sections/VaultDashboardSection";
import { VaultCardsSection } from "./sections/VaultCardsSection";
import { VaultAcquireSection } from "./sections/VaultAcquireSection";
import { VaultCreateSection } from "./sections/VaultCreateSection";
import { VaultImportSection } from "./sections/VaultImportSection";
import NumberFlow from "~/components/ui/number-flow";

const SECTION_TITLES: Record<VaultSection, string> = {
  dashboard: "MyVault",
  cards: "Card Collection",
  acquire: "Acquire Cards",
  create: "Trade & Sell",
  import: "NS Import",
};

function VaultRouterInner() {
  const { user } = useUser();
  const pathname = usePathname();

  const [activeSection, setActiveSection] = useState<VaultSection>(
    () => getSectionFromPathname(pathname)
  );

  // Resolve initial sub-tab from the URL so deep links land on the right tab
  const [initialSubTab] = useState(() => getSubTabFromPathname(pathname));

  // Fetch balance for hero
  const { data: balanceData } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  // Navigate to a section (instant client-side switch)
  const handleNavigate = useCallback((section: VaultSection) => {
    if (section === activeSection) return;
    setActiveSection(section);

    const href = section === "dashboard" ? "/vault" : `/vault/${section}`;
    window.history.pushState(null, "", href);

    document.title = section === "dashboard"
      ? "MyVault - IxStats"
      : `${SECTION_TITLES[section]} - MyVault - IxStats`;

    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSection]);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromPathname(window.location.pathname);
      setActiveSection(newSection);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Set initial page title
  useEffect(() => {
    document.title = activeSection === "dashboard"
      ? "MyVault - IxStats"
      : `${SECTION_TITLES[activeSection]} - MyVault - IxStats`;
  }, [activeSection]);

  // Hero section with vault branding + IxCredits balance
  const heroSection = (
    <div className="glass-hierarchy-child flex items-center justify-between rounded-xl border border-border px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-md shadow-purple-500/30">
          <Coins className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground sm:text-xl">
            {SECTION_TITLES[activeSection]}
          </h1>
          <p className="text-xs text-muted-foreground">IxCards Collection System</p>
        </div>
      </div>

      {/* IxCredits balance */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 backdrop-blur-sm">
        <Coins className="h-4 w-4 text-amber-500" />
        <NumberFlow
          value={balanceData?.credits ?? 0}
          format="default"
          className="text-base font-bold tabular-nums text-amber-500 sm:text-lg"
        />
        <span className="hidden text-xs text-muted-foreground sm:inline">IxC</span>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <VaultDashboardSection onNavigate={handleNavigate} />;
      case "cards":
        return <VaultCardsSection initialTab={initialSubTab} />;
      case "acquire":
        return <VaultAcquireSection initialTab={initialSubTab} />;
      case "create":
        return <VaultCreateSection initialTab={initialSubTab} />;
      case "import":
        return <VaultImportSection initialTab={initialSubTab} />;
      default:
        return null;
    }
  };

  return (
    <VaultSidebarLayout
      heroSection={heroSection}
      activeSection={activeSection}
      onNavigate={handleNavigate}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          {renderSection()}
        </motion.div>
      </AnimatePresence>
    </VaultSidebarLayout>
  );
}

export function VaultRouter() {
  return (
    <AuthenticationGuard redirectPath="/vault">
      <VaultRouterInner />
    </AuthenticationGuard>
  );
}
