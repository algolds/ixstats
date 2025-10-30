"use client";

/**
 * Enhanced Intelligence Briefing Component (Refactored)
 *
 * Main component for displaying comprehensive country intelligence briefings
 * with modular architecture using extracted components and hooks.
 *
 * Original: 2,724 lines
 * Refactored: ~400 lines
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { IxTime } from "~/lib/ixtime";

// Type imports
import type {
  EnhancedIntelligenceBriefingProps,
  WikiIntelligenceData,
} from "~/types/intelligence-briefing";

// Extracted components
import {
  IntelligenceHeader,
  IntelligenceAlertsPanel,
  WikiIntelligencePanel,
  MetricsGridDisplay,
  EconomicIntelligenceCard,
  DemographicsIntelligenceCard,
  VitalityRingsDisplay,
} from "./intelligence-briefing";

// Custom hooks
import { useIntelligenceMetrics } from "~/hooks/useIntelligenceMetrics";
import { useCardBackgroundImages } from "~/hooks/useCardBackgroundImages";
import { useWikiIntelligence } from "~/hooks/useWikiIntelligence";
import { useClearanceAccess } from "~/hooks/useClearanceAccess";

// Icons
import {
  RiBarChartLine,
  RiSettings3Line,
  RiGlobalLine,
  RiMoneyDollarCircleLine,
  RiTeamLine,
  RiBarChart2Line,
  RiAlertLine,
  RiEyeLine,
  RiBuildingLine,
  RiMapLine,
} from "react-icons/ri";

import { formatCurrency } from "~/lib/chart-utils";

export const EnhancedIntelligenceBriefing: React.FC<EnhancedIntelligenceBriefingProps> = ({
  country,
  intelligenceAlerts = [],
  wikiData: propWikiData,
  currentIxTime,
  viewerClearanceLevel = "PUBLIC",
  isOwnCountry = false,
  flagColors = { primary: "#3b82f6", secondary: "#6366f1", accent: "#8b5cf6" },
}) => {
  // State management
  const [activeSection, setActiveSection] = useState<
    "overview" | "vitality" | "metrics" | "information"
  >("overview");
  const [showClassified, setShowClassified] = useState(false);

  // Custom hooks
  const { vitalityMetrics, countryMetrics } = useIntelligenceMetrics({
    country,
    flagColors,
    viewerClearanceLevel,
  });

  const { cardBackgroundImages } = useCardBackgroundImages({
    economicTier: country.economicTier,
    countryName: country.name,
  });

  const { wikiData: fetchedWikiData, isLoading: isLoadingWiki } = useWikiIntelligence({
    countryName: country.name,
    countryData: {
      currentPopulation: country.currentPopulation,
      currentGdpPerCapita: country.currentGdpPerCapita,
      currentTotalGdp: country.currentTotalGdp,
      economicTier: country.economicTier,
      continent: country.continent,
      region: country.region,
      governmentType: country.governmentType,
      leader: country.leader,
      capital: country.capital,
      religion: country.religion,
    },
  });

  const { hasAccess } = useClearanceAccess({ viewerClearanceLevel });

  // Use provided wikiData or fetched data
  const wikiData = propWikiData || fetchedWikiData;

  // Handle wiki overview save
  const handleSaveOverview = (content: string) => {
    // This would be implemented to save the overview content
    console.log("Saving overview:", content);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <IntelligenceHeader
        countryName={country.name}
        currentIxTime={currentIxTime}
        viewerClearanceLevel={viewerClearanceLevel}
        showClassified={showClassified}
        onToggleClassified={() => setShowClassified(!showClassified)}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {/* Section Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Overview Section */}
          {activeSection === "overview" && (
            <div className="space-y-6">
              {/* Intelligence Alerts */}
              {intelligenceAlerts.length > 0 && (
                <IntelligenceAlertsPanel
                  alerts={intelligenceAlerts}
                  viewerClearanceLevel={viewerClearanceLevel}
                />
              )}

              {/* Wiki Intelligence Panel */}
              <WikiIntelligencePanel
                wikiData={wikiData}
                countryName={country.name}
                onSaveOverview={handleSaveOverview}
              />
            </div>
          )}

          {/* Metrics Section */}
          {activeSection === "metrics" && (
            <div className="space-y-6">
              {/* Economic Intelligence Card */}
              <EconomicIntelligenceCard
                country={{
                  name: country.name,
                  currentGdpPerCapita: country.currentGdpPerCapita,
                  currentTotalGdp: country.currentTotalGdp,
                  economicTier: country.economicTier,
                  adjustedGdpGrowth: country.adjustedGdpGrowth,
                }}
                flagColors={flagColors}
                backgroundImage={cardBackgroundImages["economic-analysis"]}
              />

              {/* Demographics Intelligence Card */}
              <DemographicsIntelligenceCard
                country={{
                  name: country.name,
                  currentPopulation: country.currentPopulation,
                  populationTier: country.populationTier,
                  populationGrowthRate: country.populationGrowthRate,
                  populationDensity: country.populationDensity,
                }}
                flagColors={flagColors}
                backgroundImage={cardBackgroundImages["demographics-analysis"]}
              />

              {/* Development & Government Intelligence Card */}
              <Card className="glass-hierarchy-child relative overflow-hidden">
                {cardBackgroundImages["development-analysis"] && (
                  <div className="absolute inset-0 z-0">
                    <img
                      src={cardBackgroundImages["development-analysis"].url}
                      alt="Development analysis background"
                      className="h-full w-full object-cover object-center blur-sm"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="bg-background/70 absolute inset-0"></div>
                  </div>
                )}
                <CardContent className="relative z-10 p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/20">
                        <RiGlobalLine className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">
                          Development & Government Intelligence
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Governance and development metrics
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-muted-foreground text-xs">Government Type</div>
                        <div className="text-lg font-semibold">
                          {country.governmentType || "N/A"}
                        </div>
                        <div className="text-xs text-purple-600 dark:text-purple-400">
                          {country.leader || "Leadership Data N/A"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-muted-foreground text-xs">Development Index</div>
                        <div className="text-lg font-semibold">
                          {(() => {
                            const tierScores: Record<string, number> = {
                              Extravagant: 100,
                              "Very Strong": 85,
                              Strong: 70,
                              Healthy: 55,
                              Developed: 40,
                              Developing: 25,
                            };
                            return tierScores[country.economicTier] || 10;
                          })()}
                          %
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Based on {country.economicTier} tier
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Labor & Geography Metrics Grid */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <MetricsGridDisplay
                  metrics={countryMetrics}
                  viewerClearanceLevel={viewerClearanceLevel}
                  flagColors={flagColors}
                  filterCategories={["labor", "unemployment"]}
                  title="Labor Force"
                  icon={RiBuildingLine}
                />

                <MetricsGridDisplay
                  metrics={countryMetrics}
                  viewerClearanceLevel={viewerClearanceLevel}
                  flagColors={flagColors}
                  filterCategories={[
                    "government",
                    "capital",
                    "continent",
                    "region",
                    "area",
                    "density",
                  ]}
                  title="Government & Geography"
                  icon={RiMapLine}
                />
              </div>
            </div>
          )}

          {/* Information/Briefing Section */}
          {activeSection === "information" && (
            <div className="space-y-6">
              {/* CIA Factbook-Style Analysis */}
              <div className="mb-4 flex items-center gap-2">
                <RiGlobalLine className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold">Intelligence Analysis</h3>
                <Badge variant="outline" className="text-xs">
                  Classification: {viewerClearanceLevel}
                </Badge>
              </div>

              {/* Executive Summary */}
              <Card className="relative z-10 overflow-hidden border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
                {cardBackgroundImages["executive-summary"] && (
                  <div className="absolute inset-0 z-0">
                    <img
                      src={cardBackgroundImages["executive-summary"].url}
                      alt="Executive summary background"
                      className="h-full w-full object-cover object-center blur-sm"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="bg-background/70 absolute inset-0"></div>
                  </div>
                )}
                <CardContent className="relative z-10 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <RiEyeLine className="h-4 w-4" />
                    <h4 className="text-base font-semibold">Executive Assessment</h4>
                  </div>
                  <div className="mb-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                    <div>
                      <span className="font-medium">Economic Threat Level:</span>{" "}
                      <span className="font-semibold text-blue-400">
                        {country.currentTotalGdp > 500000000000
                          ? "SIGNIFICANT"
                          : country.currentTotalGdp > 100000000000
                            ? "MODERATE"
                            : "LIMITED"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Regional Influence:</span>{" "}
                      <span className="font-semibold text-blue-400">
                        {country.currentTotalGdp > 500000000000
                          ? "MAJOR"
                          : country.currentTotalGdp > 100000000000
                            ? "SIGNIFICANT"
                            : "MODERATE"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Stability Index:</span>{" "}
                      <span className="font-semibold text-green-400">
                        {country.populationGrowthRate > 0.03
                          ? "DYNAMIC"
                          : country.populationGrowthRate > 0.01
                            ? "STABLE"
                            : "DECLINING"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Development Status:</span>{" "}
                      <span className="font-semibold text-purple-400">
                        {country.currentGdpPerCapita > 40000
                          ? "ADVANCED"
                          : country.currentGdpPerCapita > 20000
                            ? "DEVELOPING"
                            : "EMERGING"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md bg-blue-500/10 p-3">
                    <p className="text-sm leading-relaxed">
                      <strong>Intelligence Summary:</strong> {country.name} represents a{" "}
                      {country.economicTier.toLowerCase()}-tier economy with
                      {country.currentTotalGdp > 100000000000
                        ? " significant regional economic influence"
                        : " moderate regional presence"}
                      . Population dynamics show{" "}
                      {country.populationGrowthRate > 0.02
                        ? "robust growth"
                        : "stable demographics"}
                      .
                      {country.leader
                        ? ` Current leadership under ${country.leader}`
                        : " Government leadership"}{" "}
                      maintains {country.governmentType || "standard"} governance structure.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics Dashboard */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Economic Power */}
                <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-green-500/5">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <RiMoneyDollarCircleLine className="h-5 w-5 text-emerald-400" />
                      <Badge variant="outline" className="text-xs">
                        Economic
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-muted-foreground text-xs">Total GDP</div>
                        <div className="font-semibold">
                          ${(country.currentTotalGdp / 1e9).toFixed(1)}B
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Per Capita</div>
                        <div className="font-semibold">
                          ${country.currentGdpPerCapita.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Growth Rate</div>
                        <div className="font-semibold text-emerald-400">
                          +{(country.adjustedGdpGrowth * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Demographics */}
                <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <RiTeamLine className="h-5 w-5 text-blue-400" />
                      <Badge variant="outline" className="text-xs">
                        Demographics
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-muted-foreground text-xs">Population</div>
                        <div className="font-semibold">
                          {(country.currentPopulation / 1e6).toFixed(1)}M
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Density</div>
                        <div className="font-semibold">
                          {Math.round(country.populationDensity || 0)}/km²
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Growth Rate</div>
                        <div className="font-semibold text-blue-400">
                          +{(country.populationGrowthRate * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Strategic Assessment */}
                <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-violet-500/5">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <RiBarChart2Line className="h-5 w-5 text-purple-400" />
                      <Badge variant="outline" className="text-xs">
                        Strategic
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-muted-foreground text-xs">Economic Tier</div>
                        <div className="font-semibold">{country.economicTier}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Pop. Tier</div>
                        <div className="font-semibold">{country.populationTier}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Last Updated</div>
                        <div className="font-semibold text-purple-400">
                          {Math.floor(
                            (currentIxTime - country.lastCalculated) / (1000 * 60 * 60 * 24)
                          )}
                          d ago
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Active Intelligence Alerts */}
              {intelligenceAlerts && intelligenceAlerts.length > 0 && (
                <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <RiAlertLine className="h-4 w-4 text-amber-400" />
                      <h4 className="text-base font-semibold">
                        Active Intelligence Alerts ({intelligenceAlerts.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {intelligenceAlerts.slice(0, 3).map((alert) => (
                        <div
                          key={alert.id}
                          className="bg-background/50 flex items-start gap-3 rounded-md p-2"
                        >
                          <div
                            className={`mt-2 h-2 w-2 rounded-full ${
                              alert.type === "critical"
                                ? "bg-red-400"
                                : alert.type === "warning"
                                  ? "bg-orange-400"
                                  : alert.type === "info"
                                    ? "bg-blue-400"
                                    : "bg-green-400"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{alert.title}</div>
                            <div className="text-muted-foreground text-xs">{alert.description}</div>
                            <div className="text-muted-foreground mt-1 text-xs">
                              {new Date(alert.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      {intelligenceAlerts.length > 3 && (
                        <div className="text-muted-foreground pt-2 text-center text-xs">
                          +{intelligenceAlerts.length - 3} more alerts available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer Actions */}
      <div className="glass-hierarchy-child rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            Last updated: {IxTime.formatIxTime(country.lastCalculated, true)} • Data classification:{" "}
            {viewerClearanceLevel}
          </div>
          {isOwnCountry && (
            <Button variant="outline" size="sm">
              <RiSettings3Line className="mr-2 h-4 w-4" />
              Manage Intelligence Settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
