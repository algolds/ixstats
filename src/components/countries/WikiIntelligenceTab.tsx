"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WikiIntelligenceTabProps } from "~/types/wiki-intelligence";
import { useWikiIntelligence } from "~/hooks/useWikiIntelligence";
import { WikiHeader } from "./wiki/WikiHeader";
import { WikiSectionCard } from "./wiki/WikiSectionCard";
import { WikiInfoBoxSidebar } from "./wiki/WikiInfoBoxSidebar";
import { WikiConflictsView } from "./wiki/WikiConflictsView";
import { WikiSettingsView } from "./wiki/WikiSettingsView";
import WikiContentModal from "./wiki/WikiContentModal";
import { WikiFooter } from "./wiki/WikiFooter";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { RiAlertLine, RiRefreshLine } from "react-icons/ri";

/**
 * WikiIntelligenceTab Component
 *
 * Displays wiki intelligence data for a country with multiple views:
 * - Sections (Dossier): Main wiki content organized by topic
 * - Conflicts (Analysis): Data discrepancies between wiki and IxStats
 * - Settings: Configuration for wiki data discovery
 *
 * @component
 * @example
 * ```tsx
 * <WikiIntelligenceTab
 *   countryName="Burgundie"
 *   countryData={{
 *     currentPopulation: 123456789,
 *     currentGdpPerCapita: 50000,
 *     currentTotalGdp: 6172839450000,
 *     economicTier: "Developed",
 *     continent: "Levantia",
 *     governmentType: "Federal Republic"
 *   }}
 *   viewerClearanceLevel="RESTRICTED"
 *   flagColors={{ primary: "#3b82f6", secondary: "#6366f1", accent: "#8b5cf6" }}
 * />
 * ```
 */
export const WikiIntelligenceTab: React.FC<WikiIntelligenceTabProps> = ({
  countryName,
  countryData,
  viewerClearanceLevel = "PUBLIC",
  flagColors = { primary: "#3b82f6", secondary: "#6366f1", accent: "#8b5cf6" },
}) => {
  // State for active view
  const [activeView, setActiveView] = useState<"sections" | "conflicts" | "settings">("sections");

  // State for modal
  const [modalSection, setModalSection] = useState<{
    title: string;
    content: string;
    id: string;
  } | null>(null);

  // Use custom hook for data management
  const {
    wikiData,
    dataConflicts,
    wikiSettings,
    setWikiSettings,
    openSections,
    toggleSection,
    handleRefresh,
    isLoading,
    isRefreshing,
    hasAccess,
  } = useWikiIntelligence({
    countryName,
    countryData,
  });

  // Handle wiki link clicks
  const handleWikiLinkClick = useCallback((pageName: string) => {
    console.log(`[WikiIntelligence] Wiki link clicked: ${pageName}`);
    const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(pageName)}`;
    window.open(wikiUrl, "_blank", "noopener,noreferrer");
  }, []);

  // Handle settings apply
  const handleApplySettings = useCallback(async () => {
    console.log("[WikiIntelligence] Applying advanced settings:", wikiSettings);
    console.log("[WikiIntelligence] Custom pages:", wikiSettings.customPages);
    await handleRefresh();
  }, [wikiSettings, handleRefresh]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-hierarchy-child">
          <CardContent className="p-8">
            <div className="space-y-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (wikiData.error) {
    return (
      <Card className="glass-hierarchy-child">
        <CardContent className="p-8 text-center">
          <RiAlertLine className="mx-auto mb-4 h-12 w-12 text-red-600 dark:text-red-400" />
          <h3 className="mb-2 text-lg font-semibold">Wiki Intelligence Unavailable</h3>
          <p className="text-muted-foreground mb-4">{wikiData.error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RiRefreshLine className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Get flag image URL for header background
  const flagImageUrl =
    wikiData.infobox?.image_flag || wikiData.infobox?.flag
      ? `https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_flag || wikiData.infobox.flag}`
      : undefined;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <WikiHeader
          countryName={countryName}
          hasInfobox={!!wikiData.infobox}
          activeView={activeView}
          setActiveView={setActiveView}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          dataConflictsCount={dataConflicts.length}
          viewerClearanceLevel={viewerClearanceLevel}
          flagImageUrl={flagImageUrl}
        />

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Sections View (Dossier) */}
            {activeView === "sections" && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
                {/* Main Content - Dossier Sections */}
                <div className="space-y-4 xl:col-span-3">
                  {wikiData.sections
                    .filter(
                      (section) => hasAccess(section.classification) && section.id !== "overview"
                    )
                    .map((section) => (
                      <WikiSectionCard
                        key={section.id}
                        section={section}
                        isOpen={openSections[section.id] ?? true}
                        onToggle={() => toggleSection(section.id)}
                        onShowFullContent={setModalSection}
                        handleWikiLinkClick={handleWikiLinkClick}
                        flagColors={flagColors}
                        countryName={countryName}
                      />
                    ))}
                </div>

                {/* Right Sidebar - Wiki Infobox */}
                <div className="xl:col-span-1">
                  <WikiInfoBoxSidebar
                    infobox={wikiData.infobox}
                    handleWikiLinkClick={handleWikiLinkClick}
                    onRefresh={handleRefresh}
                    flagColors={flagColors}
                    viewerClearanceLevel={viewerClearanceLevel}
                  />
                </div>
              </div>
            )}

            {/* Conflicts View (Analysis) */}
            {activeView === "conflicts" && <WikiConflictsView dataConflicts={dataConflicts} />}

            {/* Settings View */}
            {activeView === "settings" && (
              <WikiSettingsView
                wikiSettings={wikiSettings}
                setWikiSettings={setWikiSettings}
                countryName={countryName}
                onApplySettings={handleApplySettings}
                isApplying={isRefreshing}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <WikiFooter
          lastUpdated={wikiData.lastUpdated}
          confidence={wikiData.confidence}
          sectionCount={wikiData.sections.length}
        />
      </div>

      {/* Full Content Modal */}
      <WikiContentModal
        isOpen={!!modalSection}
        onClose={() => setModalSection(null)}
        section={modalSection}
        handleWikiLinkClick={handleWikiLinkClick}
        flagColors={flagColors}
        enableIxWiki={wikiSettings.enableIxWiki}
      />
    </>
  );
};

export default WikiIntelligenceTab;
