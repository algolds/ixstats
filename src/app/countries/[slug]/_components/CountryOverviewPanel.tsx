"use client";

// Refactored from main CountryPage - displays overview tab content with wiki intro, government, vitality rings
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { VitalityRings } from "~/components/mycountry/primitives/VitalityRings";
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
} from "lucide-react";
import type { CountryInfobox } from "~/lib/mediawiki-service";
import { sanitizeWikiContent } from "~/lib/sanitize-html";
import { safeFormatCurrency } from "~/lib/format-utils";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { CountryActivityModal } from "./CountryActivityModal";

interface CountryOverviewPanelProps {
  country: {
    id: string;
    name: string;
    currentPopulation: number;
    currentTotalGdp: number;
    currentGdpPerCapita: number;
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

  // Fetch recent activity for this country
  const { data: activityData, isLoading: activityLoading } =
    api.activities.getCountryActivity.useQuery({
      countryId: country.id,
      limit: 5,
      timeRange: "7d",
    });

  return (
    <>
      <div className="space-y-6">
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
                    {/* Text content - 2 columns */}
                    <div className="md:col-span-2">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {/* First paragraph - always visible */}
                        <p
                          className="mb-3 text-sm leading-relaxed"
                          // SECURITY: Sanitize wiki content to prevent XSS from external data
                          dangerouslySetInnerHTML={{
                            __html: sanitizeWikiContent(wikiIntro[0] ?? ""),
                          }}
                        />

                        {/* Additional paragraphs - collapsible */}
                        {wikiIntro.length > 1 && (
                          <>
                            {showFullWikiIntro && (
                              <div className="space-y-3">
                                {wikiIntro.slice(1).map((paragraph, idx) => (
                                  <p
                                    key={idx}
                                    className="mb-3 text-sm leading-relaxed"
                                    // SECURITY: Sanitize wiki content to prevent XSS from external data
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

                    {/* National Symbols - 1 column */}
                    {wikiInfobox &&
                      (wikiInfobox.image_flag || wikiInfobox.flag || wikiInfobox.image_coat) && (
                        <div className="space-y-4">
                          <div>
                            <h3 className="mb-4 text-lg font-semibold">National Symbols</h3>
                          </div>
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

            {/* Government & National Identity */}
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Government & National Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(governmentStructure?.governmentName ||
                    country?.nationalIdentity?.officialName) && (
                    <div className="flex items-start gap-3">
                      <Building className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Government</p>
                        <p className="font-semibold">
                          {governmentStructure?.governmentName ||
                            country?.nationalIdentity?.officialName}
                        </p>
                      </div>
                    </div>
                  )}

                  {(governmentStructure?.governmentType ||
                    country?.governmentType ||
                    country?.nationalIdentity?.governmentType) && (
                    <div className="flex items-start gap-3">
                      <Crown className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Government Type</p>
                        <p className="font-semibold">
                          {governmentStructure?.governmentType ||
                            country?.governmentType ||
                            country?.nationalIdentity?.governmentType}
                        </p>
                      </div>
                    </div>
                  )}

                  {(governmentStructure?.headOfState || country?.leader) && (
                    <div className="flex items-start gap-3">
                      <Users className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Head of State</p>
                        <p className="font-semibold">
                          {governmentStructure?.headOfState || country?.leader}
                        </p>
                      </div>
                    </div>
                  )}

                  {governmentStructure?.headOfGovernment && (
                    <div className="flex items-start gap-3">
                      <Users className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Head of Government</p>
                        <p className="font-semibold">{governmentStructure.headOfGovernment}</p>
                      </div>
                    </div>
                  )}

                  {(country?.nationalIdentity?.capitalCity || wikiInfobox?.capital) && (
                    <div className="flex items-start gap-3">
                      <MapPin className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Capital</p>
                        <p className="font-semibold">
                          {country?.nationalIdentity?.capitalCity || wikiInfobox?.capital}
                        </p>
                      </div>
                    </div>
                  )}

                  {country?.religion && (
                    <div className="flex items-start gap-3">
                      <Heart className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Religion</p>
                        <p className="font-semibold">{country.religion}</p>
                      </div>
                    </div>
                  )}

                  {(country?.nationalIdentity?.currency || wikiInfobox?.currency) && (
                    <div className="flex items-start gap-3">
                      <Globe className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Currency</p>
                        <p className="font-semibold">
                          {country?.nationalIdentity?.currency || wikiInfobox?.currency}
                          {country?.nationalIdentity?.currencySymbol
                            ? ` (${country.nationalIdentity.currencySymbol})`
                            : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {governmentStructure?.legislatureName && (
                    <div className="flex items-start gap-3">
                      <Building className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Legislature</p>
                        <p className="font-semibold">{governmentStructure.legislatureName}</p>
                      </div>
                    </div>
                  )}

                  {governmentStructure?.executiveName && (
                    <div className="flex items-start gap-3">
                      <Building className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Executive</p>
                        <p className="font-semibold">{governmentStructure.executiveName}</p>
                      </div>
                    </div>
                  )}

                  {governmentStructure?.judicialName && (
                    <div className="flex items-start gap-3">
                      <Building className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Judiciary</p>
                        <p className="font-semibold">{governmentStructure.judicialName}</p>
                      </div>
                    </div>
                  )}

                  {typeof governmentStructure?.totalBudget === "number" && (
                    <div className="flex items-start gap-3">
                      <TrendingUp className="text-primary mt-0.5 h-5 w-5" />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Total Budget</p>
                        <p className="font-semibold">
                          {safeFormatCurrency(
                            governmentStructure!.totalBudget!,
                            governmentStructure?.budgetCurrency || "USD",
                            false,
                            "USD"
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {(country?.nationalIdentity?.motto || wikiInfobox?.motto) && (
                  <div className="mt-6 border-t pt-6">
                    <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                      National Motto
                    </p>
                    <p className="text-muted-foreground border-primary/30 border-l-4 pl-4 text-base italic">
                      &ldquo;{country?.nationalIdentity?.motto || wikiInfobox?.motto}&rdquo;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity Feed - Live Wired */}
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>Latest developments and milestones</CardDescription>
                  </div>
                  {activityData && activityData.activities.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowActivityModal(true)}
                      className="text-xs"
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
                            return <Trophy className="h-4 w-4 text-yellow-500" />;
                          case "economic":
                            return <TrendingUp className="h-4 w-4 text-blue-500" />;
                          case "diplomatic":
                            return <Users className="h-4 w-4 text-purple-500" />;
                          case "social":
                            return <MessageSquare className="h-4 w-4 text-green-500" />;
                          default:
                            return <Activity className="text-muted-foreground h-4 w-4" />;
                        }
                      };

                      const getActivityColor = () => {
                        switch (activity.type) {
                          case "achievement":
                            return "bg-yellow-400";
                          case "economic":
                            return "bg-blue-400";
                          case "diplomatic":
                            return "bg-purple-400";
                          case "social":
                            return "bg-green-400";
                          default:
                            return "bg-muted-foreground";
                        }
                      };

                      return (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-3 ${
                            idx < activityData.activities.length - 1
                              ? "border-border/50 border-b pb-3"
                              : ""
                          }`}
                        >
                          <div
                            className={`h-2 w-2 rounded-full ${getActivityColor()} mt-2 flex-shrink-0`}
                          ></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                {getActivityIcon()}
                                <p className="truncate text-sm font-medium">{activity.title}</p>
                              </div>
                              {activity.source === "thinkpages" && (
                                <Badge variant="outline" className="flex-shrink-0 text-xs">
                                  ThinkPages
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                              {activity.description}
                            </p>
                            <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(activity.timestamp), {
                                  addSuffix: true,
                                })}
                              </div>
                              {activity.engagement && (
                                <>
                                  {activity.engagement.likes > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Heart className="h-3 w-3" />
                                      {activity.engagement.likes}
                                    </span>
                                  )}
                                  {activity.engagement.comments > 0 && (
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" />
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
                        <p className="text-sm">Economic data updated</p>
                        <p className="text-muted-foreground text-xs">
                          {country.lastCalculated &&
                            new Date(country.lastCalculated).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {wikiInfobox && (
                      <div className="flex items-start gap-3">
                        <div className="mt-2 h-2 w-2 rounded-full bg-green-400"></div>
                        <div className="flex-1">
                          <p className="text-sm">Wiki profile connected</p>
                          <p className="text-muted-foreground text-xs">Live data from IxWiki</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

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
                      onClick={() => onTabChange("lore")}
                      className="w-full justify-start"
                    >
                      <BookOpen className="mr-2 h-3 w-3" />
                      Lore
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTabChange("diplomatic")}
                      className="w-full justify-start"
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      ThinkPages
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

          {/* Sidebar - National Vitality Rings */}
          <div className="space-y-6">
            <VitalityRings data={vitalityData} variant="sidebar" />
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
    </>
  );
}
