// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { motion } from "motion/react";
import { Bell, AlertTriangle, ChevronRight } from "lucide-react";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { AnimatedTabContent, staggerItem, CardImageUploadModal } from "./primitives";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { GdpDetailsModal } from "~/components/modals/GdpDetailsModal";
import { PopulationDetailsModal } from "~/components/modals/PopulationDetailsModal";
import {
  LaborDetailsModal,
  GovernmentSpendingModal,
  DebtAnalysisModal,
  DemographicsHealthModal,
} from "~/components/modals/metric-details";
import { useMyCountryNavigation } from "~/hooks/useMyCountryNavigation";
import { useMyCountryMetrics } from "~/hooks/useMyCountryMetrics";
import { MyCountryTabsList, OverviewTab, EconomyTab, LaborTab, GovernmentTab, GeographyTab } from "./tabs";
import { UpgradeTeaser } from "./premium/UpgradeTeaser";

interface MyCountryTabSystemProps {
  variant?: "unified" | "standard" | "premium";
}

function MyCountryTabSystemComponent({ variant = "unified" }: MyCountryTabSystemProps) {
  const { activeTab, tabDirection, handleTabChange } = useMyCountryNavigation();
  const {
    country,
    economyData,
    countryImageData,
    governmentStructure,
    metricView,
    setMetricView,
    wikiSectionsOpen,
    setWikiSectionsOpen,
    wikiIntro,
    wikiLoading,
    wikiImages,
    wikiSections,
    sectionsLoading,
    imageUploadModal,
    setImageUploadModal,
    isMetricModalOpen,
    metricType,
    modalCountryId,
    openMetricModal,
    closeMetricModal,
  } = useMyCountryMetrics(activeTab);

  if (!country) return null;

  const govComponentCount = governmentStructure?.components?.length ?? 0;

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <MyCountryTabsList
        activeTab={activeTab}
        onChangeAction={handleTabChange}
        govComponentCount={govComponentCount}
      />

      {/* Animated tab content wrapper */}
      <AnimatedTabContent activeTab={activeTab} direction={tabDirection} mode="slide">
        {/* Overview Tab — single unified card */}
        <TabsContent value="overview" className="space-y-2" id="overview">
          <OverviewTab
            country={country}
            wikiIntro={wikiIntro}
            wikiImages={wikiImages}
            wikiLoading={wikiLoading}
            wikiSections={wikiSections}
            sectionsLoading={sectionsLoading}
            metricView={metricView}
            setMetricViewAction={setMetricView}
            wikiSectionsOpen={wikiSectionsOpen}
            setWikiSectionsOpenAction={setWikiSectionsOpen}
          />
        </TabsContent>

        {/* Economy Tab */}
        <TabsContent value="economy" className="space-y-4" id="economy">
          <EconomyTab
            country={country}
            economyData={economyData}
            countryImageData={countryImageData}
            setImageUploadModalAction={setImageUploadModal}
            openMetricModalAction={openMetricModal}
            metricView={metricView}
            setMetricViewAction={setMetricView}
          />
        </TabsContent>

        {/* Labor Tab */}
        <TabsContent value="labor" id="labor">
          <LaborTab
            country={country}
            economyData={economyData}
            countryImageData={countryImageData}
            setImageUploadModalAction={setImageUploadModal}
            openMetricModalAction={openMetricModal}
            metricView={metricView}
            setMetricViewAction={setMetricView}
          />
        </TabsContent>

        {/* Government Tab */}
        <TabsContent value="government" className="space-y-4" id="government">
          <GovernmentTab
            country={country}
            economyData={economyData}
            countryImageData={countryImageData}
            governmentStructure={governmentStructure}
            setImageUploadModalAction={setImageUploadModal}
            openMetricModalAction={openMetricModal}
            metricView={metricView}
            setMetricViewAction={setMetricView}
          />
        </TabsContent>

        {/* Geography Tab — moved from sidebar to its own tab after Government.
            Spatial (geometry/coordinates) lives in the map editor; this tab
            owns the geographic attribute UI plus the rollup settings modal. */}
        <TabsContent value="geography" className="space-y-4" id="geography">
          <GeographyTab />
        </TabsContent>

        {/* Demographics and Analytics tabs removed — demographics belongs in Intelligence (premium),
            analytics belongs in Dashboard World section. See cross-pillar refactor plan. */}
      </AnimatedTabContent>

      {/* Render premium upgrade teaser */}
      <UpgradeTeaser variant={variant} />

      {/* Card Image Upload Modal */}
      <CardImageUploadModal
        isOpen={imageUploadModal.isOpen}
        onClose={() => setImageUploadModal({ ...imageUploadModal, isOpen: false })}
        countryId={country?.id || ""}
        cardType={imageUploadModal.cardType}
      />

      {/* Metric Detail Modals */}
      {(metricType === "gdp" || metricType === "gdp-per-capita" || metricType === "total-gdp") && (
        <GdpDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "population" || metricType === "population-density") && (
        <PopulationDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "labor-force" ||
        metricType === "employment" ||
        metricType === "unemployment") && (
        <LaborDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {metricType === "government-spending" && (
        <GovernmentSpendingModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {metricType === "debt" && (
        <DebtAnalysisModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "demographics-health" || metricType === "life-expectancy") && (
        <DemographicsHealthModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}
    </Tabs>
  );
}

MyCountryTabSystemComponent.displayName = "MyCountryTabSystem";

// Compact issues banner for the Overview tab
export function OverviewIssuesBanner({ countryId }: { countryId: string }) {
  const { total, urgent } = useIssueCount(countryId);

  if (total === 0) return null;

  const navigateToIssues = () => {
    window.history.pushState({}, "", "/mycountry/executive");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <motion.div variants={staggerItem}>
      <button
        onClick={navigateToIssues}
        className={cn(
          "w-full rounded-xl border p-3 text-left transition-all hover:shadow-md",
          urgent > 0
            ? "border-red-500/30 bg-red-500/5 hover:border-red-500/50"
            : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                urgent > 0 ? "bg-red-500/15" : "bg-amber-500/15"
              )}
            >
              {urgent > 0 ? (
                <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
              ) : (
                <Bell className="h-4.5 w-4.5 text-amber-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {total} National Issue{total !== 1 ? "s" : ""} Pending
                </span>
                {urgent > 0 && (
                  <Badge
                    variant="outline"
                    className="border-red-500/30 bg-red-500/10 px-1.5 py-0 text-[10px] font-bold text-red-500"
                  >
                    {urgent} URGENT
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {urgent > 0
                  ? "Urgent issues require your immediate attention"
                  : "Review and respond to pending national issues"}
              </p>
            </div>
          </div>
          <ChevronRight className={cn("h-4 w-4", urgent > 0 ? "text-red-500" : "text-amber-500")} />
        </div>
      </button>
    </motion.div>
  );
}

export const MyCountryTabSystem = React.memo(MyCountryTabSystemComponent);
