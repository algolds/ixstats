"use client";

// Refactored from main CountryPage - displays overview tab content with wiki intro, government, vitality rings
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { VitalityRings } from "~/components/mycountry/primitives/VitalityRings";
import { BookOpen, ExternalLink, Building, Crown, Users, MapPin, Heart, Globe, TrendingUp, Activity, Trophy, MessageSquare, ArrowRight, Clock } from "lucide-react";
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
  const { data: activityData, isLoading: activityLoading } = api.activities.getCountryActivity.useQuery({
    countryId: country.id,
    limit: 5,
    timeRange: '7d',
  });

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Wiki Overview Section */}
          {wikiIntro.length > 0 && (
            <Card className="backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  About {country.name.replace(/_/g, " ")}
                </CardTitle>
                <CardDescription>Historical overview and background</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Text content - 2 columns */}
                  <div className="md:col-span-2">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {/* First paragraph - always visible */}
                      <p
                        className="mb-3 text-sm leading-relaxed"
                        // SECURITY: Sanitize wiki content to prevent XSS from external data
                        dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(wikiIntro[0] ?? '') }}
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
                                  dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(paragraph) }}
                                />
                              ))}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowFullWikiIntro(!showFullWikiIntro)}
                            className="mt-2 text-primary hover:text-primary/80"
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
                    <div className="mt-4 pt-4 border-t">
                      <a
                        href={`https://ixwiki.com/wiki/${country.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-2"
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
                          <h3 className="text-lg font-semibold mb-4">National Symbols</h3>
                        </div>
                        {(wikiInfobox.image_flag || wikiInfobox.flag) && (
                          <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
                            <img
                              src={`https://ixwiki.com/wiki/Special:Filepath/${
                                wikiInfobox.image_flag || wikiInfobox.flag
                              }`}
                              alt="National Flag"
                              className="w-16 h-10 rounded shadow-md object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground mb-1">National Flag</p>
                              <p className="text-sm font-medium">Official Symbol</p>
                            </div>
                          </div>
                        )}
                        {(wikiInfobox.image_coat || wikiInfobox.coat_of_arms) && (
                          <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg">
                            <img
                              src={`https://ixwiki.com/wiki/Special:Filepath/${
                                wikiInfobox.image_coat || wikiInfobox.coat_of_arms
                              }`}
                              alt="Coat of Arms"
                              className="w-12 h-12 rounded shadow-md object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground mb-1">Coat of Arms</p>
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
          <Card className="backdrop-blur-sm bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Government & National Identity
              </CardTitle>
             
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(governmentStructure?.governmentName || country?.nationalIdentity?.officialName) && (
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Government</p>
                      <p className="font-semibold">
                        {governmentStructure?.governmentName || country?.nationalIdentity?.officialName}
                      </p>
                    </div>
                  </div>
                )}

                {(governmentStructure?.governmentType ||
                  country?.governmentType ||
                  country?.nationalIdentity?.governmentType) && (
                  <div className="flex items-start gap-3">
                    <Crown className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Government Type</p>
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
                    <Users className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Head of State</p>
                      <p className="font-semibold">
                        {governmentStructure?.headOfState || country?.leader}
                      </p>
                    </div>
                  </div>
                )}

                {governmentStructure?.headOfGovernment && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Head of Government</p>
                      <p className="font-semibold">{governmentStructure.headOfGovernment}</p>
                    </div>
                  </div>
                )}

                {(country?.nationalIdentity?.capitalCity || wikiInfobox?.capital) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Capital</p>
                      <p className="font-semibold">
                        {country?.nationalIdentity?.capitalCity || wikiInfobox?.capital}
                      </p>
                    </div>
                  </div>
                )}

                {country?.religion && (
                  <div className="flex items-start gap-3">
                    <Heart className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Religion</p>
                      <p className="font-semibold">{country.religion}</p>
                    </div>
                  </div>
                )}

                {(country?.nationalIdentity?.currency || wikiInfobox?.currency) && (
                  <div className="flex items-start gap-3">
                    <Globe className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Currency</p>
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
                    <Building className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Legislature</p>
                      <p className="font-semibold">{governmentStructure.legislatureName}</p>
                    </div>
                  </div>
                )}

                {governmentStructure?.executiveName && (
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Executive</p>
                      <p className="font-semibold">{governmentStructure.executiveName}</p>
                    </div>
                  </div>
                )}

                {governmentStructure?.judicialName && (
                  <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Judiciary</p>
                      <p className="font-semibold">{governmentStructure.judicialName}</p>
                    </div>
                  </div>
                )}

                {typeof governmentStructure?.totalBudget === "number" && (
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
                      <p className="font-semibold">
                        {safeFormatCurrency(governmentStructure!.totalBudget!, governmentStructure?.budgetCurrency || "USD", false, "USD")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {(country?.nationalIdentity?.motto || wikiInfobox?.motto) && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    National Motto
                  </p>
                  <p className="text-base italic text-muted-foreground border-l-4 border-primary/30 pl-4">
                    &ldquo;{country?.nationalIdentity?.motto || wikiInfobox?.motto}&rdquo;
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Feed - Live Wired */}
          <Card className="backdrop-blur-sm bg-card/50">
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
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-muted mt-2"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activityData && activityData.activities.length > 0 ? (
                <div className="space-y-3">
                  {activityData.activities.slice(0, 5).map((activity, idx) => {
                    const getActivityIcon = () => {
                      switch (activity.type) {
                        case 'achievement':
                          return <Trophy className="h-4 w-4 text-yellow-500" />;
                        case 'economic':
                          return <TrendingUp className="h-4 w-4 text-blue-500" />;
                        case 'diplomatic':
                          return <Users className="h-4 w-4 text-purple-500" />;
                        case 'social':
                          return <MessageSquare className="h-4 w-4 text-green-500" />;
                        default:
                          return <Activity className="h-4 w-4 text-muted-foreground" />;
                      }
                    };

                    const getActivityColor = () => {
                      switch (activity.type) {
                        case 'achievement':
                          return 'bg-yellow-400';
                        case 'economic':
                          return 'bg-blue-400';
                        case 'diplomatic':
                          return 'bg-purple-400';
                        case 'social':
                          return 'bg-green-400';
                        default:
                          return 'bg-muted-foreground';
                      }
                    };

                    return (
                      <div
                        key={activity.id}
                        className={`flex items-start gap-3 ${
                          idx < activityData.activities.length - 1 ? 'pb-3 border-b border-border/50' : ''
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${getActivityColor()} mt-2 flex-shrink-0`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {getActivityIcon()}
                              <p className="text-sm font-medium truncate">{activity.title}</p>
                            </div>
                            {activity.source === 'thinkpages' && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                ThinkPages
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
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
                  <div className="flex items-start gap-3 pb-3 border-b border-border/50">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm">Economic data updated</p>
                      <p className="text-xs text-muted-foreground">
                        {country.lastCalculated && new Date(country.lastCalculated).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {wikiInfobox && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-400 mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm">Wiki profile connected</p>
                        <p className="text-xs text-muted-foreground">Live data from IxWiki</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Navigation Card */}
          <Card className="backdrop-blur-sm bg-card/50 border-primary/20">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <h3 className="font-semibold mb-3">Explore {country.name.replace(/_/g, " ")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTabChange("mycountry")}
                    className="w-full justify-start"
                  >
                    <Crown className="h-3 w-3 mr-2" />
                    MyCountry
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTabChange("lore")}
                    className="w-full justify-start"
                  >
                    <BookOpen className="h-3 w-3 mr-2" />
                    Lore
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTabChange("diplomatic")}
                    className="w-full justify-start"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    ThinkPages
                  </Button>
                  <a
                    href={`https://ixwiki.com/wiki/${country.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <ExternalLink className="h-3 w-3 mr-2" />
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
