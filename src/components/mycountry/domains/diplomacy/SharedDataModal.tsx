"use client";

import React, { useState } from "react";
import {
  ShareAndroid as Share2,
  Lock,
  LockSlash as Unlock,
  StatsReport as BarChart3,
  Group as Users,
  City as Building2,
  Trophy as Award,
  Calendar,
  CheckCircle,
  InfoCircle as Info,
  Database,
  CreditCard,
} from "iconoir-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { SharedDataType } from "~/types/diplomatic-network";
import { MultiSelect } from "~/components/ui/multi-select";
import {
  DATA_TYPE_CONFIG,
  EconomicDataTab,
  IntelligenceDataTab,
  ResearchDataTab,
  CulturalDataTab,
  PolicyDataTab,
  AllDataTab,
} from "./shared-data/shared-data-views";

type SharedDataTab = SharedDataType | "all" | "overview";

const SHARED_DATA_TABS: readonly SharedDataTab[] = [
  "overview",
  "all",
  "economic",
  "intelligence",
  "research",
  "cultural",
  "policy",
];
const isSharedDataTab = (value: string): value is SharedDataTab =>
  SHARED_DATA_TABS.some((tab) => tab === value);

interface SharedDataModalProps {
  embassyId: string;
  onClose: () => void;
  isOwner: boolean;
}

export function SharedDataModal({ embassyId, onClose, isOwner }: SharedDataModalProps) {
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<SharedDataTab>("overview");
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [overviewData, setOverviewData] = useState({
    description: "",
    priorities: [] as string[],
    goals: [] as string[],
    achievements: [] as string[],
  });

  const { data: embassy, isLoading: isLoadingEmbassy } =
    api.diplomaticEmbassies.getEmbassyDetails.useQuery(
      { embassyId },
      { enabled: !!embassyId, refetchInterval: 30000 }
    );

  const currentUserCountryId = embassy?.guestCountryId;
  const hasDataAccess =
    embassy &&
    (currentUserCountryId === embassy.hostCountryId ||
      currentUserCountryId === embassy.guestCountryId);

  const shouldFetchData = activeTab !== "overview" && hasDataAccess;
  const dataType = activeTab === "all" || activeTab === "overview" ? undefined : activeTab;

  const {
    data: sharedData,
    isLoading: isLoadingData,
    refetch,
  } = api.diplomaticCore.getSharedData.useQuery(
    { embassyId, dataType },
    { enabled: !!embassyId && shouldFetchData, refetchInterval: 30000 }
  );

  const { data: diplomaticOptions } = api.diplomaticCore.getAllDiplomaticOptions.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  const updateProfileMutation = api.diplomaticEmbassies.updateEmbassyProfile.useMutation({
    onSuccess: () => {
      notify.success("Embassy profile updated successfully");
      setIsEditingOverview(false);
    },
    onError: (error) => {
      notify.error(`Failed to update profile: ${error.message}`);
    },
  });

  const isLoading = isLoadingEmbassy || isLoadingData;

  React.useEffect(() => {
    if (embassy && !isEditingOverview) {
      try {
        setOverviewData({
          description: embassy.description || "",
          priorities: embassy.strategicPriorities ? JSON.parse(embassy.strategicPriorities) : [],
          goals: embassy.partnershipGoals ? JSON.parse(embassy.partnershipGoals) : [],
          achievements: embassy.keyAchievements ? JSON.parse(embassy.keyAchievements) : [],
        });
      } catch (error) {
        console.error("Failed to parse embassy profile data:", error);
        setOverviewData({
          description: embassy.description || "",
          priorities: [],
          goals: [],
          achievements: [],
        });
      }
    }
  }, [embassy, isEditingOverview]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-full max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="text-muted-foreground h-5 w-5" />
            Embassy Partnership
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {embassy?.hostCountryId || "Loading…"} ⟷ {embassy?.guestCountryId || "Loading…"}
            {hasDataAccess ? (
              <Badge variant="default">
                <Unlock />
                Authorized
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Lock />
                Public View
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 py-6">
          {isLoading ? (
            <div className="space-y-4" role="status" aria-label="Loading shared data">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-6">
              {embassy && (
                <FacetCard surface="solid" className="rounded-xl">
                  <FacetCardHeader>
                    <h3 className="text-foreground flex items-center gap-2 font-semibold">
                      <Building2 className="text-muted-foreground h-5 w-5" />
                      Embassy Overview
                    </h3>
                  </FacetCardHeader>
                  <FacetCardContent className="p-6 pt-0">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div className="space-y-1">
                        <Eyebrow className="block">Level</Eyebrow>
                        <div className="text-foreground text-2xl font-semibold tabular-nums">
                          {embassy.level || 1}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Eyebrow className="block">Influence</Eyebrow>
                        <div className="text-foreground text-2xl font-semibold tabular-nums">
                          {embassy.influence?.toFixed(0) || 0}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Eyebrow className="block">Staff</Eyebrow>
                        <div className="text-foreground text-2xl font-semibold tabular-nums">
                          {embassy.staffCount || 0}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Eyebrow className="block">Established</Eyebrow>
                        <div className="text-sm font-semibold">
                          {embassy.establishedAt
                            ? new Date(embassy.establishedAt).toLocaleDateString()
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                  </FacetCardContent>
                </FacetCard>
              )}

              {/* Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  if (isSharedDataTab(v)) setActiveTab(v);
                }}
              >
                <TabsList className="bg-muted/50 flex w-full flex-wrap gap-1 rounded-xl p-1">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="all" disabled={!hasDataAccess}>
                    All Data
                  </TabsTrigger>
                  <TabsTrigger value="economic" disabled={!hasDataAccess}>
                    Economic
                  </TabsTrigger>
                  <TabsTrigger value="intelligence" disabled={!hasDataAccess}>
                    Intelligence
                  </TabsTrigger>
                  <TabsTrigger value="research" disabled={!hasDataAccess}>
                    Research
                  </TabsTrigger>
                  <TabsTrigger value="cultural" disabled={!hasDataAccess}>
                    Cultural
                  </TabsTrigger>
                  <TabsTrigger value="policy" disabled={!hasDataAccess}>
                    Policy
                  </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                  <TabsContent value="overview" className="space-y-6">
                    {/* Strategic Profile */}
                    <FacetCard surface="solid" className="rounded-xl">
                      <FacetCardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                          <h3 className="text-foreground text-base font-semibold">
                            Strategic Profile
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            Mission, priorities, and partnership objectives
                          </p>
                        </div>
                        {isOwner && (
                          <div className="flex gap-2">
                            {isEditingOverview ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    updateProfileMutation.mutate({
                                      embassyId,
                                      description: overviewData.description,
                                      strategicPriorities: JSON.stringify(overviewData.priorities),
                                      partnershipGoals: JSON.stringify(overviewData.goals),
                                      keyAchievements: JSON.stringify(overviewData.achievements),
                                    });
                                  }}
                                  disabled={updateProfileMutation.isPending}
                                >
                                  Save Profile
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setIsEditingOverview(false)}
                                  disabled={updateProfileMutation.isPending}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsEditingOverview(true)}
                              >
                                Edit Profile
                              </Button>
                            )}
                          </div>
                        )}
                      </FacetCardHeader>
                      <FacetCardContent className="space-y-6 p-6 pt-0">
                        {/* Strategic Priorities */}
                        <div>
                          <h4 className="mb-3 text-sm font-semibold">
                            Strategic Priorities (max 3)
                          </h4>
                          {isEditingOverview ? (
                            <MultiSelect
                              options={diplomaticOptions?.strategicPriorities ?? []}
                              value={overviewData.priorities}
                              onChange={(value) =>
                                setOverviewData((prev) => ({ ...prev, priorities: value }))
                              }
                              placeholder="Select up to 3 strategic priorities..."
                              maxSelections={3}
                            />
                          ) : (
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                              {overviewData.priorities.length > 0 ? (
                                overviewData.priorities.map((priority, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="justify-center py-2 text-center"
                                  >
                                    {priority}
                                  </Badge>
                                ))
                              ) : (
                                <p className="text-muted-foreground col-span-3 text-sm">
                                  No priorities set. Click Edit to add priorities.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Goals */}
                        <div>
                          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                            <CheckCircle className="h-4 w-4" />
                            Partnership Goals (max 3)
                          </h4>
                          {isEditingOverview ? (
                            <MultiSelect
                              options={diplomaticOptions?.partnershipGoals ?? []}
                              value={overviewData.goals}
                              onChange={(value) =>
                                setOverviewData((prev) => ({ ...prev, goals: value }))
                              }
                              placeholder="Select up to 3 partnership goals..."
                              maxSelections={3}
                            />
                          ) : (
                            <ul className="space-y-2">
                              {overviewData.goals.length > 0 ? (
                                overviewData.goals.map((goal, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm">
                                    <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-500" />
                                    <span>{goal}</span>
                                  </li>
                                ))
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  No goals set. Click Edit to add goals.
                                </p>
                              )}
                            </ul>
                          )}
                        </div>

                        {/* Achievements */}
                        <div>
                          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                            <Award className="h-4 w-4" />
                            Key Achievements (max 5)
                          </h4>
                          {isEditingOverview ? (
                            <MultiSelect
                              options={diplomaticOptions?.keyAchievements ?? []}
                              value={overviewData.achievements}
                              onChange={(value) =>
                                setOverviewData((prev) => ({
                                  ...prev,
                                  achievements: value,
                                }))
                              }
                              placeholder="Select up to 5 key achievements..."
                              maxSelections={5}
                            />
                          ) : (
                            <ul className="space-y-2">
                              {overviewData.achievements.length > 0 ? (
                                overviewData.achievements.map((achievement, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm">
                                    <Award className="text-muted-foreground mt-0.5 h-4 w-4" />
                                    <span>{achievement}</span>
                                  </li>
                                ))
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  No achievements set. Click Edit to add achievements.
                                </p>
                              )}
                            </ul>
                          )}
                        </div>

                        {/* Quick Stats */}
                        <div className="border-t pt-4">
                          <h4 className="mb-3 text-sm font-semibold">At a Glance</h4>
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="bg-muted/50 rounded-lg p-3 text-center">
                              <Calendar className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
                              <Eyebrow className="block">Established</Eyebrow>
                              <div className="font-semibold">
                                {embassy?.establishedAt
                                  ? new Date(embassy.establishedAt).getFullYear()
                                  : "N/A"}
                              </div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3 text-center">
                              <Users className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
                              <Eyebrow className="block">Staff</Eyebrow>
                              <div className="font-semibold">{embassy?.staffCount || 0}</div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3 text-center">
                              <BarChart3 className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
                              <Eyebrow className="block">Influence</Eyebrow>
                              <div className="font-semibold">
                                {embassy?.influence?.toFixed(0) || 0}
                              </div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3 text-center">
                              <Building2 className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
                              <Eyebrow className="block">Level</Eyebrow>
                              <div className="font-semibold">{embassy?.level || 1}</div>
                            </div>
                          </div>
                        </div>
                      </FacetCardContent>
                    </FacetCard>

                    {/* Shared Data Access Cards */}
                    {hasDataAccess && embassy && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FacetCard surface="solid" className="rounded-xl">
                          <FacetCardHeader className="pb-3">
                            <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                              <Building2 className="text-muted-foreground h-4 w-4" />
                              {embassy.hostCountryId || "Host Country"}
                            </h3>
                            <p className="text-muted-foreground text-xs">
                              Host country shared data
                            </p>
                          </FacetCardHeader>
                          <FacetCardContent className="space-y-3 p-6 pt-0">
                            <div className="text-muted-foreground text-sm">
                              Access shared economic data, intelligence reports, research findings,
                              cultural programs, and policy documents from the host nation.
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                onClick={() => setActiveTab("all")}
                                className="w-full"
                                variant="outline"
                                size="sm"
                              >
                                <Database className="h-4 w-4" />
                                View Data
                              </Button>
                              {isOwner && (
                                <Button className="w-full" variant="outline" size="sm" asChild>
                                  <Link
                                    href={`/vault/market?nation=${encodeURIComponent(embassy.hostCountryId || "")}`}
                                  >
                                    <CreditCard className="h-4 w-4" />
                                    Trade Cards
                                  </Link>
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Lock className="text-muted-foreground h-3 w-3" />
                              <span className="text-muted-foreground">
                                Secure diplomatic channel
                              </span>
                            </div>
                          </FacetCardContent>
                        </FacetCard>

                        <FacetCard surface="solid" className="rounded-xl">
                          <FacetCardHeader className="pb-3">
                            <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                              <Building2 className="text-muted-foreground h-4 w-4" />
                              {embassy.guestCountryId || "Guest Country"}
                            </h3>
                            <p className="text-muted-foreground text-xs">
                              Guest country shared data
                            </p>
                          </FacetCardHeader>
                          <FacetCardContent className="space-y-3 p-6 pt-0">
                            <div className="text-muted-foreground text-sm">
                              Access shared economic data, intelligence reports, research findings,
                              cultural programs, and policy documents from the guest nation.
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                onClick={() => setActiveTab("all")}
                                className="w-full"
                                variant="outline"
                                size="sm"
                              >
                                <Database className="h-4 w-4" />
                                View Data
                              </Button>
                              {!isOwner && (
                                <Button className="w-full" variant="outline" size="sm" asChild>
                                  <Link
                                    href={`/vault/market?nation=${encodeURIComponent(embassy.guestCountryId || "")}`}
                                  >
                                    <CreditCard className="h-4 w-4" />
                                    Trade Cards
                                  </Link>
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Lock className="text-muted-foreground h-3 w-3" />
                              <span className="text-muted-foreground">
                                Secure diplomatic channel
                              </span>
                            </div>
                          </FacetCardContent>
                        </FacetCard>
                      </div>
                    )}

                    {!hasDataAccess && (
                      <FacetCard surface="solid" className="rounded-xl">
                        <FacetCardContent className="px-6 py-8">
                          <div className="space-y-3 text-center">
                            <Lock className="text-muted-foreground mx-auto h-6 w-6" />
                            <h3 className="text-foreground text-base font-semibold">
                              Restricted Access
                            </h3>
                            <p className="text-muted-foreground mx-auto max-w-md text-sm">
                              Shared data is only accessible to the host and guest countries
                              involved in this diplomatic relationship. Public users can view the
                              embassy overview above.
                            </p>
                          </div>
                        </FacetCardContent>
                      </FacetCard>
                    )}
                  </TabsContent>

                  {hasDataAccess && (
                    <>
                      <TabsContent value="all" className="space-y-4">
                        <AllDataTab data={sharedData} isOwner={isOwner} />
                      </TabsContent>
                      <TabsContent value="economic" className="space-y-4">
                        <EconomicDataTab data={sharedData?.economic} />
                      </TabsContent>
                      <TabsContent value="intelligence" className="space-y-4">
                        <IntelligenceDataTab data={sharedData?.intelligence} isOwner={isOwner} />
                      </TabsContent>
                      <TabsContent value="research" className="space-y-4">
                        <ResearchDataTab data={sharedData?.research} />
                      </TabsContent>
                      <TabsContent value="cultural" className="space-y-4">
                        <CulturalDataTab data={sharedData?.cultural} />
                      </TabsContent>
                      <TabsContent value="policy" className="space-y-4">
                        <PolicyDataTab data={sharedData?.policy} />
                      </TabsContent>
                    </>
                  )}
                </div>
              </Tabs>

              {isOwner && hasDataAccess && (
                <FacetCard surface="solid" className="rounded-xl">
                  <FacetCardContent className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Info className="text-muted-foreground h-4 w-4" />
                        <span className="text-muted-foreground text-sm">
                          Manage data sharing settings
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => notify.info("Share new data functionality coming soon")}
                        >
                          <Share2 className="h-4 w-4" />
                          Share New Data
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </FacetCardContent>
                </FacetCard>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
