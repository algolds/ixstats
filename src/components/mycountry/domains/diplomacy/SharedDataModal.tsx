"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import {
  Xmark as X,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
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

interface SharedDataModalProps {
  embassyId: string;
  onClose: () => void;
  isOwner: boolean;
}

export function SharedDataModal({ embassyId, onClose, isOwner }: SharedDataModalProps) {
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<SharedDataType | "all" | "overview">("overview");
  const [mounted, setMounted] = useState(false);
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [overviewData, setOverviewData] = useState({
    description: "",
    priorities: [] as string[],
    goals: [] as string[],
    achievements: [] as string[],
  });

  React.useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

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

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "relative max-h-[90vh] w-full max-w-6xl overflow-hidden",
            "bg-background/95 border-border/50 rounded-2xl border shadow-2xl backdrop-blur-xl",
            "glass-hierarchy-modal"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-background/95 border-border/50 sticky top-0 z-10 border-b px-6 py-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                  <Share2 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Embassy Partnership</h2>
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    {embassy?.hostCountryId || "Loading..."} ⟷{" "}
                    {embassy?.guestCountryId || "Loading..."}
                    {hasDataAccess ? (
                      <Badge variant="default" className="ml-2">
                        <Unlock className="mr-1 h-3 w-3" />
                        Authorized
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2">
                        <Lock className="mr-1 h-3 w-3" />
                        Public View
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="space-y-3 text-center">
                  <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
                  <p className="text-muted-foreground text-sm">Loading shared data...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {embassy && (
                  <Card className="facet-hierarchy-child border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-500" />
                        Embassy Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="space-y-1">
                          <div className="text-muted-foreground text-xs">Level</div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {embassy.level || 1}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground text-xs">Influence</div>
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {embassy.influence?.toFixed(0) || 0}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground text-xs">Staff</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {embassy.staffCount || 0}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground text-xs">Established</div>
                          <div className="text-sm font-semibold">
                            {embassy.establishedAt
                              ? new Date(embassy.establishedAt).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-7">
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
                      <Card className="facet-hierarchy-child border-blue-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                          <div>
                            <CardTitle className="text-lg">Strategic Profile</CardTitle>
                            <CardDescription>
                              Mission, priorities, and partnership objectives
                            </CardDescription>
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
                                        strategicPriorities: JSON.stringify(
                                          overviewData.priorities
                                        ),
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
                        </CardHeader>
                        <CardContent className="space-y-6">
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
                                      <CheckCircle className="mt-0.5 h-4 w-4 text-green-500" />
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
                                      <Award className="mt-0.5 h-4 w-4 text-amber-500" />
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
                              <div className="bg-background/50 rounded-lg p-3 text-center">
                                <Calendar className="mx-auto mb-1 h-4 w-4 text-blue-500" />
                                <div className="text-muted-foreground text-xs">Established</div>
                                <div className="font-semibold">
                                  {embassy?.establishedAt
                                    ? new Date(embassy.establishedAt).getFullYear()
                                    : "N/A"}
                                </div>
                              </div>
                              <div className="bg-background/50 rounded-lg p-3 text-center">
                                <Users className="mx-auto mb-1 h-4 w-4 text-green-500" />
                                <div className="text-muted-foreground text-xs">Staff</div>
                                <div className="font-semibold">{embassy?.staffCount || 0}</div>
                              </div>
                              <div className="bg-background/50 rounded-lg p-3 text-center">
                                <BarChart3 className="mx-auto mb-1 h-4 w-4 text-purple-500" />
                                <div className="text-muted-foreground text-xs">Influence</div>
                                <div className="font-semibold">
                                  {embassy?.influence?.toFixed(0) || 0}
                                </div>
                              </div>
                              <div className="bg-background/50 rounded-lg p-3 text-center">
                                <Building2 className="mx-auto mb-1 h-4 w-4 text-amber-500" />
                                <div className="text-muted-foreground text-xs">Level</div>
                                <div className="font-semibold">{embassy?.level || 1}</div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Shared Data Access Cards */}
                      {hasDataAccess && embassy && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <Card className="facet-hierarchy-child border-blue-500/20 transition-colors hover:border-blue-500/40">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Building2 className="h-4 w-4 text-blue-500" />
                                {embassy.hostCountryId || "Host Country"}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                Host country shared data
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="text-muted-foreground text-sm">
                                Access shared economic data, intelligence reports, research
                                findings, cultural programs, and policy documents from the host
                                nation.
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  onClick={() => setActiveTab("all")}
                                  className="w-full"
                                  variant="outline"
                                  size="sm"
                                >
                                  <Database className="mr-2 h-4 w-4" />
                                  View Data
                                </Button>
                                {isOwner && (
                                  <Link
                                    href={`/vault/market?nation=${encodeURIComponent(embassy.hostCountryId || "")}`}
                                  >
                                    <Button className="w-full" variant="outline" size="sm">
                                      <CreditCard className="mr-2 h-4 w-4" />
                                      Trade Cards
                                    </Button>
                                  </Link>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <Lock className="h-3 w-3 text-green-500" />
                                <span className="text-muted-foreground">
                                  Secure diplomatic channel
                                </span>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="facet-hierarchy-child border-purple-500/20 transition-colors hover:border-purple-500/40">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Building2 className="h-4 w-4 text-purple-500" />
                                {embassy.guestCountryId || "Guest Country"}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                Guest country shared data
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="text-muted-foreground text-sm">
                                Access shared economic data, intelligence reports, research
                                findings, cultural programs, and policy documents from the guest
                                nation.
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  onClick={() => setActiveTab("all")}
                                  className="w-full"
                                  variant="outline"
                                  size="sm"
                                >
                                  <Database className="mr-2 h-4 w-4" />
                                  View Data
                                </Button>
                                {!isOwner && (
                                  <Link
                                    href={`/vault/market?nation=${encodeURIComponent(embassy.guestCountryId || "")}`}
                                  >
                                    <Button className="w-full" variant="outline" size="sm">
                                      <CreditCard className="mr-2 h-4 w-4" />
                                      Trade Cards
                                    </Button>
                                  </Link>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <Lock className="h-3 w-3 text-green-500" />
                                <span className="text-muted-foreground">
                                  Secure diplomatic channel
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {!hasDataAccess && (
                        <Card className="facet-hierarchy-child border-amber-500/20 bg-amber-500/5">
                          <CardContent className="py-8">
                            <div className="space-y-3 text-center">
                              <Lock className="mx-auto h-12 w-12 text-amber-500" />
                              <h3 className="text-lg font-semibold">Restricted Access</h3>
                              <p className="text-muted-foreground mx-auto max-w-md text-sm">
                                Shared data is only accessible to the host and guest countries
                                involved in this diplomatic relationship. Public users can view the
                                embassy overview above.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
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
                  <Card className="facet-hierarchy-child border-amber-500/20 bg-amber-500/5">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-amber-500" />
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
                            <Share2 className="mr-2 h-4 w-4" />
                            Share New Data
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => refetch()}>
                            Refresh
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
