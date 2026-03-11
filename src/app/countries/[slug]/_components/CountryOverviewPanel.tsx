"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { VitalityRings } from "~/components/mycountry/primitives/VitalityRings";
import { GdpDetailsModal } from "~/components/modals/GdpDetailsModal";
import { GdpPerCapitaDetailsModal } from "~/components/modals/GdpPerCapitaDetailsModal";
import { PopulationDetailsModal } from "~/components/modals/PopulationDetailsModal";
import {
  BookOpen,
  ExternalLink,
  Building,
  Crown,
  Users,
  MapPin,
  Heart,
  Globe,
  TrendingUp,
  Activity,
  Trophy,
  MessageSquare,
  ArrowRight,
  Clock,
  DollarSign,
  Handshake,
  ChevronRight,
} from "lucide-react";
import type { CountryInfobox } from "~/lib/mediawiki-service";
import { sanitizeWikiContent } from "~/lib/sanitize-html";
import { safeFormatCurrency } from "~/lib/format-utils";
import {
  formatCompactCurrency,
  formatPercentWithNormalization as formatPercent,
} from "~/lib/format-utils";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { CountryActivityModal } from "./CountryActivityModal";
import { createUrl } from "~/lib/url-utils";

const CountryMapEmbed = dynamic(
  () => import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({ default: m.CountryMapEmbed })),
  { ssr: false, loading: () => <div className="h-56 animate-pulse rounded-b-xl bg-muted" /> }
);

interface CountryOverviewPanelProps {
  country: {
    id: string;
    name: string;
    currentPopulation: number;
    currentTotalGdp: number;
    currentGdpPerCapita: number;
    adjustedGdpGrowth?: number | null;
    lastCalculated?: Date | number;
    governmentType?: string | null;
    leader?: string | null;
    religion?: string | null;
    nationalIdentity?: {
      officialName?: string | null;
      governmentType?: string | null;
      capitalCity?: string | null;
      currency?: string | null;
      currencySymbol?: string | null;
      motto?: string | null;
    } | null;
  };
  wikiIntro: string[];
  wikiInfobox: CountryInfobox | null;
  vitalityData: {
    economicVitality: number;
    populationWellbeing: number;
    diplomaticStanding: number;
    governmentalEfficiency: number;
  };
  governmentStructure?: {
    governmentName?: string | null;
    governmentType?: string | null;
    headOfState?: string | null;
    headOfGovernment?: string | null;
    legislatureName?: string | null;
    executiveName?: string | null;
    judicialName?: string | null;
    totalBudget?: number;
    budgetCurrency?: string;
  } | null;
  onTabChange: (tab: string) => void;
}

export function CountryOverviewPanel({
  country,
  wikiIntro,
  wikiInfobox,
  vitalityData,
  governmentStructure,
  onTabChange,
}: CountryOverviewPanelProps) {
  const [showFullWikiIntro, setShowFullWikiIntro] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [isPopulationModalOpen, setIsPopulationModalOpen] = useState(false);
  const [isGdpModalOpen, setIsGdpModalOpen] = useState(false);
  const [isGdpPerCapitaModalOpen, setIsGdpPerCapitaModalOpen] = useState(false);

  const { data: activityData, isLoading: activityLoading } =
    api.activities.getCountryActivity.useQuery({
      countryId: country.id,
      limit: 5,
      timeRange: "30d",
    });

  const keyMetrics = [
    {
      label: "Population",
      value: Math.round(country.currentPopulation).toLocaleString(),
      detail: "Total citizens",
      icon: Users,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      onClick: () => setIsPopulationModalOpen(true),
    },
    {
      label: "GDP",
      value: formatCompactCurrency(country.currentTotalGdp),
      detail: "Nominal GDP (annual)",
      icon: DollarSign,
      color: "bg-green-500/10 text-green-600 dark:text-green-400",
      onClick: () => setIsGdpModalOpen(true),
    },
    {
      label: "GDP per Capita",
      value: formatCompactCurrency(country.currentGdpPerCapita),
      detail: "Average output per citizen",
      icon: TrendingUp,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      onClick: () => setIsGdpPerCapitaModalOpen(true),
    },
    {
      label: "Growth",
      value: formatPercent(country.adjustedGdpGrowth, "N/A", 2),
      detail: "Adjusted GDP growth rate",
      icon: Activity,
      color:
        (country.adjustedGdpGrowth ?? 0) > 0
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400",
      onClick: undefined as (() => void) | undefined,
    },
  ];

  // Build government fields - first 6 are shown, rest behind "See more"
  const primaryGovFields: Array<{ label: string; value: string; icon: React.ComponentType<{ className?: string }> }> = [];
  const hasMoreGovFields = useHasMoreGovFields(governmentStructure, country, wikiInfobox);

  const govName = governmentStructure?.governmentName || country?.nationalIdentity?.officialName;
  if (govName) primaryGovFields.push({ label: "Government", value: govName, icon: Building });

  const govType = governmentStructure?.governmentType || country?.governmentType || country?.nationalIdentity?.governmentType;
  if (govType) primaryGovFields.push({ label: "Government Type", value: govType, icon: Crown });

  const hos = governmentStructure?.headOfState || country?.leader;
  if (hos) primaryGovFields.push({ label: "Head of State", value: hos, icon: Users });

  if (governmentStructure?.headOfGovernment) primaryGovFields.push({ label: "Head of Government", value: governmentStructure.headOfGovernment, icon: Users });

  const capital = country?.nationalIdentity?.capitalCity || wikiInfobox?.capital;
  if (capital) primaryGovFields.push({ label: "Capital", value: capital, icon: MapPin });

  if (country?.religion) primaryGovFields.push({ label: "Religion", value: country.religion, icon: Heart });

  return (
    <>
      <div className="space-y-6">
        {/* Key Metrics Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {keyMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <button
                key={metric.label}
                type="button"
                onClick={metric.onClick}
                disabled={!metric.onClick}
                className="group rounded-xl border border-border/50 bg-card/80 p-4 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className={`rounded-lg p-1.5 ${metric.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {metric.label}
                  </p>
                </div>
                <p className="mt-2 text-xl font-bold">{metric.value}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{metric.detail}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Wiki Overview Section */}
            {wikiIntro.length > 0 && (
              <Card className="bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    About {country.name.replace(/_/g, " ")}
                  </CardTitle>
                  <CardDescription>Historical overview and background</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p
                          className="mb-3 text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeWikiContent(wikiIntro[0] ?? ""),
                          }}
                        />
                        {wikiIntro.length > 1 && (
                          <>
                            {showFullWikiIntro && (
                              <div className="space-y-3">
                                {wikiIntro.slice(1).map((paragraph, idx) => (
                                  <p
                                    key={idx}
                                    className="mb-3 text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeWikiContent(paragraph),
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowFullWikiIntro(!showFullWikiIntro)}
                              className="text-primary hover:text-primary/80 mt-2"
                            >
                              {showFullWikiIntro ? (
                                <>Show less</>
                              ) : (
                                <>
                                  See more ({wikiIntro.length - 1} more paragraph
                                  {wikiIntro.length > 2 ? "s" : ""})
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="mt-4 border-t pt-4">
                        <a
                          href={`https://ixwiki.com/wiki/${country.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary flex items-center gap-2 text-sm hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Read more on IxWiki
                        </a>
                      </div>
                    </div>

                    {wikiInfobox &&
                      (wikiInfobox.image_flag || wikiInfobox.flag || wikiInfobox.image_coat) && (
                        <div className="space-y-4">
                          <h3 className="mb-4 text-lg font-semibold">National Symbols</h3>
                          {(wikiInfobox.image_flag || wikiInfobox.flag) && (
                            <div className="flex items-center gap-3 rounded-lg bg-blue-500/10 p-3">
                              <img
                                src={`https://ixwiki.com/wiki/Special:Filepath/${
                                  wikiInfobox.image_flag || wikiInfobox.flag
                                }`}
                                alt="National Flag"
                                className="h-10 w-16 rounded object-cover shadow-md"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              <div className="flex-1">
                                <p className="text-muted-foreground mb-1 text-xs">National Flag</p>
                                <p className="text-sm font-medium">Official Symbol</p>
                              </div>
                            </div>
                          )}
                          {(wikiInfobox.image_coat || wikiInfobox.coat_of_arms) && (
                            <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 p-3">
                              <img
                                src={`https://ixwiki.com/wiki/Special:Filepath/${
                                  wikiInfobox.image_coat || wikiInfobox.coat_of_arms
                                }`}
                                alt="Coat of Arms"
                                className="h-12 w-12 rounded object-cover shadow-md"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              <div className="flex-1">
                                <p className="text-muted-foreground mb-1 text-xs">Coat of Arms</p>
                                <p className="text-sm font-medium">State Emblem</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Government & National Identity - Collapsible */}
            {primaryGovFields.length > 0 && (
              <Card className="bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Government & National Identity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {primaryGovFields.map((field) => {
                      const Icon = field.icon;
                      return (
                        <div key={field.label} className="flex items-start gap-3">
                          <Icon className="text-primary mt-0.5 h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground mb-1 text-xs">{field.label}</p>
                            <p className="font-semibold">{field.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {hasMoreGovFields && (
                    <div className="mt-4 border-t pt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTabChange("mycountry")}
                        className="text-primary hover:text-primary/80 gap-2"
                      >
                        See all details
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Navigation Card */}
            <Card className="bg-card/50 border-primary/20 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <h3 className="mb-3 font-semibold">Explore {country.name.replace(/_/g, " ")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTabChange("mycountry")}
                      className="w-full justify-start"
                    >
                      <Crown className="mr-2 h-3 w-3" />
                      MyCountry
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTabChange("activity")}
                      className="w-full justify-start"
                    >
                      <Activity className="mr-2 h-3 w-3" />
                      Activity
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTabChange("diplomacy")}
                      className="w-full justify-start"
                    >
                      <Handshake className="mr-2 h-3 w-3" />
                      Diplomacy
                    </Button>
                    <a
                      href={`https://ixwiki.com/wiki/${country.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Open in Wiki
                      </Button>
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Geography + Vitality Rings + Recent Activity */}
          <div className="space-y-6">
            {/* Geography Map */}
            <Card className="bg-card/50 overflow-hidden backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4" />
                  Geography
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CountryMapEmbed
                  countryId={country.id}
                  height="h-56"
                  showNeighbors={true}
                  showCities={true}
                  boundsPadding={50}
                />
              </CardContent>
              <div className="flex items-center justify-between border-t border-border/50 px-4 py-2">
                <span className="text-xs text-muted-foreground">
                  {country.currentPopulation
                    ? `${Math.round(country.currentPopulation).toLocaleString()} citizens`
                    : ""}
                </span>
                <a
                  href={createUrl(`/maps?country=${country.id}`)}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  Open full map
                </a>
              </div>
            </Card>

            <VitalityRings data={vitalityData} variant="sidebar" />

            {/* Recent Activity Feed (moved to sidebar) */}
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                  {activityData && activityData.activities.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowActivityModal(true)}
                      className="h-7 px-2 text-xs"
                    >
                      View All
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex animate-pulse items-start gap-3">
                        <div className="bg-muted mt-2 h-2 w-2 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="bg-muted h-4 w-3/4 rounded"></div>
                          <div className="bg-muted h-3 w-1/2 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activityData && activityData.activities.length > 0 ? (
                  <div className="space-y-3">
                    {activityData.activities.slice(0, 5).map((activity, idx) => {
                      const getActivityIcon = () => {
                        switch (activity.type) {
                          case "achievement":
                            return <Trophy className="h-3.5 w-3.5 text-yellow-500" />;
                          case "economic":
                            return <TrendingUp className="h-3.5 w-3.5 text-blue-500" />;
                          case "diplomatic":
                            return <Users className="h-3.5 w-3.5 text-purple-500" />;
                          case "social":
                            return <MessageSquare className="h-3.5 w-3.5 text-green-500" />;
                          default:
                            return <Activity className="text-muted-foreground h-3.5 w-3.5" />;
                        }
                      };

                      const getActivityColor = () => {
                        switch (activity.type) {
                          case "achievement": return "bg-yellow-400";
                          case "economic": return "bg-blue-400";
                          case "diplomatic": return "bg-purple-400";
                          case "social": return "bg-green-400";
                          default: return "bg-muted-foreground";
                        }
                      };

                      return (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-2.5 ${
                            idx < activityData.activities.length - 1
                              ? "border-border/50 border-b pb-3"
                              : ""
                          }`}
                        >
                          <div
                            className={`h-2 w-2 rounded-full ${getActivityColor()} mt-1.5 flex-shrink-0`}
                          ></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {getActivityIcon()}
                              <p className="truncate text-xs font-medium">{activity.title}</p>
                            </div>
                            {activity.source === "thinkpages" && (
                              <Badge variant="outline" className="mt-1 h-4 text-[10px]">
                                ThinkPages
                              </Badge>
                            )}
                            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
                              <div className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDistanceToNow(new Date(activity.timestamp), {
                                  addSuffix: true,
                                })}
                              </div>
                              {activity.engagement && (
                                <>
                                  {activity.engagement.likes > 0 && (
                                    <span className="flex items-center gap-0.5">
                                      <Heart className="h-2.5 w-2.5" />
                                      {activity.engagement.likes}
                                    </span>
                                  )}
                                  {activity.engagement.comments > 0 && (
                                    <span className="flex items-center gap-0.5">
                                      <MessageSquare className="h-2.5 w-2.5" />
                                      {activity.engagement.comments}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="border-border/50 flex items-start gap-3 border-b pb-3">
                      <div className="mt-2 h-2 w-2 rounded-full bg-blue-400"></div>
                      <div className="flex-1">
                        <p className="text-xs">Economic data updated</p>
                        <p className="text-muted-foreground text-[10px]">
                          {country.lastCalculated &&
                            new Date(country.lastCalculated).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {wikiInfobox && (
                      <div className="flex items-start gap-3">
                        <div className="mt-2 h-2 w-2 rounded-full bg-green-400"></div>
                        <div className="flex-1">
                          <p className="text-xs">Wiki profile connected</p>
                          <p className="text-muted-foreground text-[10px]">Live data from IxWiki</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      <CountryActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        countryId={country.id}
        countryName={country.name}
      />

      {/* Metric Detail Modals */}
      <PopulationDetailsModal
        isOpen={isPopulationModalOpen}
        onClose={() => setIsPopulationModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
      <GdpDetailsModal
        isOpen={isGdpModalOpen}
        onClose={() => setIsGdpModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
      <GdpPerCapitaDetailsModal
        isOpen={isGdpPerCapitaModalOpen}
        onClose={() => setIsGdpPerCapitaModalOpen(false)}
        countryId={country.id}
        countryName={country.name}
      />
    </>
  );
}

function useHasMoreGovFields(
  governmentStructure: CountryOverviewPanelProps["governmentStructure"],
  country: CountryOverviewPanelProps["country"],
  wikiInfobox: CountryOverviewPanelProps["wikiInfobox"],
): boolean {
  const currency = country?.nationalIdentity?.currency || wikiInfobox?.currency;
  const legislature = governmentStructure?.legislatureName;
  const executive = governmentStructure?.executiveName;
  const judicial = governmentStructure?.judicialName;
  const budget = typeof governmentStructure?.totalBudget === "number";
  const motto = country?.nationalIdentity?.motto || wikiInfobox?.motto;

  return !!(currency || legislature || executive || judicial || budget || motto);
}

type CountryOverviewPanelProps = Parameters<typeof CountryOverviewPanel>[0];
