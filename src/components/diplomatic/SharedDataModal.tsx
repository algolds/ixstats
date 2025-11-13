"use client";

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  X,
  TrendingUp,
  Eye,
  Beaker,
  Palette,
  FileText,
  Share2,
  Lock,
  Unlock,
  BarChart3,
  Users,
  Building2,
  Award,
  Calendar,
  AlertCircle,
  CheckCircle,
  Info,
  Database,
  ArrowRight,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { SharedDataType, SharedDataCollection } from "~/types/diplomatic-network";
import { MultiSelect } from "~/components/ui/multi-select";

interface SharedDataModalProps {
  embassyId: string;
  onClose: () => void;
  isOwner: boolean; // Whether the current user owns the embassy (guestCountry)
}

const DATA_TYPE_CONFIG = {
  economic: {
    icon: TrendingUp,
    label: "Economic",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  intelligence: {
    icon: Eye,
    label: "Intelligence",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  research: {
    icon: Beaker,
    label: "Research",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
  cultural: {
    icon: Palette,
    label: "Cultural",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
  },
  policy: {
    icon: FileText,
    label: "Policy",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
} as const;

export function SharedDataModal({ embassyId, onClose, isOwner }: SharedDataModalProps) {
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
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Fetch embassy details
  const { data: embassy, isLoading: isLoadingEmbassy } = api.diplomatic.getEmbassyDetails.useQuery(
    { embassyId },
    { enabled: !!embassyId, refetchInterval: 30000 } // Refetch every 30s for real-time updates
  );

  // Get current user's country ID (from session or context)
  // For now, we'll determine access based on isOwner and embassy data
  const currentUserCountryId = embassy?.guestCountryId; // Simplified - in production get from auth

  // Check if current user has access to shared data
  const hasDataAccess =
    embassy &&
    (currentUserCountryId === embassy.hostCountryId ||
      currentUserCountryId === embassy.guestCountryId);

  // Fetch shared data (only when not on overview tab AND user has access)
  const shouldFetchData = activeTab !== "overview" && hasDataAccess;
  const dataType = activeTab === "all" || activeTab === "overview" ? undefined : activeTab;

  const {
    data: sharedData,
    isLoading: isLoadingData,
    refetch,
  } = api.diplomatic.getSharedData.useQuery(
    { embassyId, dataType },
    { enabled: !!embassyId && shouldFetchData, refetchInterval: 30000 }
  );

  // Fetch diplomatic options from database (with fallback to hardcoded values)
  const { data: diplomaticOptions } = api.diplomatic.getAllDiplomaticOptions.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  // Mutation for updating embassy profile
  const updateProfileMutation = api.diplomatic.updateEmbassyProfile.useMutation({
    onSuccess: () => {
      toast.success("Embassy profile updated successfully");
      setIsEditingOverview(false);
    },
    onError: (error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  const isLoading = isLoadingEmbassy || isLoadingData;

  // Load embassy profile data into state when embassy data loads
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

  // Handle ESC key to close
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
          transition={{ type: "spring", duration: 0.3 }}
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
                {/* Embassy Overview */}
                {embassy && (
                  <Card className="glass-hierarchy-child border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
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
                            {embassy.staffCount || 1}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground text-xs">Status</div>
                          <Badge variant={embassy.status === "ACTIVE" ? "default" : "secondary"}>
                            {embassy.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tabs for data types */}
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                  className="w-full"
                >
                  <TabsList
                    className={cn(
                      "glass-hierarchy-child",
                      hasDataAccess ? "grid w-full grid-cols-7" : "flex w-full justify-center"
                    )}
                  >
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    {hasDataAccess && (
                      <>
                        <TabsTrigger value="all">All Data</TabsTrigger>
                        <TabsTrigger value="economic">Economic</TabsTrigger>
                        <TabsTrigger value="intelligence">Intel</TabsTrigger>
                        <TabsTrigger value="research">Research</TabsTrigger>
                        <TabsTrigger value="cultural">Cultural</TabsTrigger>
                        <TabsTrigger value="policy">Policy</TabsTrigger>
                      </>
                    )}
                  </TabsList>

                  <div className="mt-6">
                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                      <Card className="glass-hierarchy-child border-primary/20 from-primary/5 bg-gradient-to-br to-blue-500/5">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                              <Building2 className="text-primary h-5 w-5" />
                              Embassy Profile
                            </CardTitle>
                            {isOwner && (
                              <div className="flex gap-2">
                                {isEditingOverview && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditingOverview(false)}
                                  >
                                    Cancel
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (isEditingOverview) {
                                      // Save the changes
                                      updateProfileMutation.mutate({
                                        embassyId,
                                        description: overviewData.description,
                                        strategicPriorities: JSON.stringify(
                                          overviewData.priorities
                                        ),
                                        partnershipGoals: JSON.stringify(overviewData.goals),
                                        keyAchievements: JSON.stringify(overviewData.achievements),
                                      });
                                    } else {
                                      setIsEditingOverview(true);
                                    }
                                  }}
                                  disabled={updateProfileMutation.isPending}
                                >
                                  {updateProfileMutation.isPending
                                    ? "Saving..."
                                    : isEditingOverview
                                      ? "Save"
                                      : "Edit"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Description */}
                          <div>
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                              <FileText className="h-4 w-4" />
                              Description
                            </h4>
                            {isEditingOverview ? (
                              <textarea
                                value={overviewData.description}
                                onChange={(e) =>
                                  setOverviewData((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                  }))
                                }
                                placeholder="Describe the nature and purpose of this diplomatic relationship..."
                                className="bg-background/50 border-border min-h-[100px] w-full resize-none rounded-lg border p-3"
                              />
                            ) : (
                              <p className="text-muted-foreground text-sm leading-relaxed">
                                {overviewData.description ||
                                  "No description set. Click Edit to add one."}
                              </p>
                            )}
                          </div>

                          {/* Priorities */}
                          <div>
                            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                              <Award className="h-4 w-4" />
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
                                      variant="secondary"
                                      className="justify-center py-2"
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
                                  setOverviewData((prev) => ({ ...prev, achievements: value }))
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
                          {/* Host Country Data Access */}
                          <Card className="glass-hierarchy-child border-blue-500/20 transition-colors hover:border-blue-500/40">
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
                                    <Button
                                      className="w-full"
                                      variant="outline"
                                      size="sm"
                                    >
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

                          {/* Guest Country Data Access */}
                          <Card className="glass-hierarchy-child border-purple-500/20 transition-colors hover:border-purple-500/40">
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
                                    <Button
                                      className="w-full"
                                      variant="outline"
                                      size="sm"
                                    >
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

                      {/* Access Denied Message for Non-Members */}
                      {!hasDataAccess && (
                        <Card className="glass-hierarchy-child border-amber-500/20 bg-amber-500/5">
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
                          {renderAllData(sharedData, isOwner)}
                        </TabsContent>
                        <TabsContent value="economic" className="space-y-4">
                          {renderEconomicData(sharedData?.economic)}
                        </TabsContent>
                        <TabsContent value="intelligence" className="space-y-4">
                          {renderIntelligenceData(sharedData?.intelligence, isOwner)}
                        </TabsContent>
                        <TabsContent value="research" className="space-y-4">
                          {renderResearchData(sharedData?.research)}
                        </TabsContent>
                        <TabsContent value="cultural" className="space-y-4">
                          {renderCulturalData(sharedData?.cultural)}
                        </TabsContent>
                        <TabsContent value="policy" className="space-y-4">
                          {renderPolicyData(sharedData?.policy)}
                        </TabsContent>
                      </>
                    )}
                  </div>
                </Tabs>

                {/* Action Buttons (Owner Only with Data Access) */}
                {isOwner && hasDataAccess && (
                  <Card className="glass-hierarchy-child border-amber-500/20 bg-amber-500/5">
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
                            onClick={() => toast.info("Share new data functionality coming soon")}
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

// Render functions for different data types
function renderAllData(data: SharedDataCollection | undefined, isOwner: boolean) {
  if (!data) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No shared data available yet</p>
        {isOwner && (
          <p className="mt-2 text-xs">
            Share data with your embassy partner to strengthen cooperation
          </p>
        )}
      </div>
    );
  }

  const hasData =
    data.economic ||
    data.intelligence?.length ||
    data.research?.length ||
    data.cultural ||
    data.policy?.length;

  if (!hasData) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No shared data available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.economic && renderEconomicData(data.economic)}
      {data.intelligence && data.intelligence.length > 0 && (
        <div className="space-y-4">{renderIntelligenceData(data.intelligence, isOwner)}</div>
      )}
      {data.research && data.research.length > 0 && renderResearchData(data.research)}
      {data.cultural && renderCulturalData(data.cultural)}
      {data.policy && data.policy.length > 0 && renderPolicyData(data.policy)}
    </div>
  );
}

function renderEconomicData(data: any) {
  if (!data) return <EmptyState type="economic" />;

  return (
    <Card className="glass-hierarchy-child border-green-500/20 bg-green-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Economic Cooperation
        </CardTitle>
        <CardDescription>Trade volume, joint ventures, and economic benefits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard
            label="Trade Volume"
            value={`$${(data.tradeVolume || 0).toLocaleString()}M`}
            trend={data.tradeGrowth}
          />
          <MetricCard label="Joint Ventures" value={data.jointVentures || 0} />
          <MetricCard
            label="Investment"
            value={`$${(data.investmentValue || 0).toLocaleString()}M`}
          />
          <MetricCard label="Tariffs Reduced" value={`${data.tariffsReduced || 0}%`} positive />
          <MetricCard
            label="Economic Benefit"
            value={`+${(data.economicBenefit || 0).toFixed(1)}%`}
            positive
          />
        </div>
      </CardContent>
    </Card>
  );
}

function renderIntelligenceData(data: any[] | undefined, isOwner: boolean) {
  if (!data || data.length === 0) return <EmptyState type="intelligence" />;

  return (
    <>
      {data.map((report, idx) => (
        <Card key={idx} className="glass-hierarchy-child border-blue-500/20 bg-blue-500/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  Intelligence Report - {report.reportType}
                </CardTitle>
                <CardDescription>{report.summary}</CardDescription>
              </div>
              <Badge variant={report.classification === "PUBLIC" ? "default" : "secondary"}>
                {report.classification}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold">Key Findings:</div>
              <ul className="space-y-1">
                {report.keyFindings?.map((finding: string, i: number) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-muted-foreground text-xs">Confidence: {report.confidence}%</div>
              <div className="text-muted-foreground text-xs">
                Updated: {new Date(report.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function renderResearchData(data: any[] | undefined) {
  if (!data || data.length === 0) return <EmptyState type="research" />;

  return (
    <>
      {data.map((project, idx) => (
        <Card key={idx} className="glass-hierarchy-child border-purple-500/20 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-purple-500" />
              {project.researchArea}
            </CardTitle>
            <CardDescription>{project.collaborators?.length || 0} collaborator(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MetricCard label="Breakthroughs" value={project.breakthroughs?.length || 0} />
              <MetricCard label="Publications" value={project.publications || 0} />
              <MetricCard label="Patents" value={project.patents || 0} />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function renderCulturalData(data: any) {
  if (!data) return <EmptyState type="cultural" />;

  return (
    <Card className="glass-hierarchy-child border-pink-500/20 bg-pink-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-pink-500" />
          Cultural Exchange
        </CardTitle>
        <CardDescription>Programs, events, and cultural impact</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard label="Exchange Programs" value={data.exchangePrograms || 0} />
          <MetricCard label="Cultural Events" value={data.culturalEvents || 0} />
          <MetricCard label="Artists Exchanged" value={data.artistsExchanged || 0} />
          <MetricCard label="Students Exchanged" value={data.studentsExchanged || 0} />
        </div>
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cultural Impact</span>
            <span className="font-semibold">{data.culturalImpactScore || 0}%</span>
          </div>
          <Progress value={data.culturalImpactScore || 0} className="h-2" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Diplomatic Goodwill</span>
            <span className="font-semibold">{data.diplomaticGoodwill || 0}%</span>
          </div>
          <Progress value={data.diplomaticGoodwill || 0} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

function renderPolicyData(data: any[] | undefined) {
  if (!data || data.length === 0) return <EmptyState type="policy" />;

  return (
    <>
      {data.map((policy, idx) => (
        <Card key={idx} className="glass-hierarchy-child border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  {policy.policyFramework}
                </CardTitle>
                <CardDescription>{policy.agreementType} agreement</CardDescription>
              </div>
              <Badge variant={policy.status === "ratified" ? "default" : "secondary"}>
                {policy.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {policy.keyProvisions && (policy.keyProvisions as string[]).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Key Provisions:</div>
                <ul className="space-y-1">
                  {(policy.keyProvisions as string[]).map((provision: string, i: number) => (
                    <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span>{provision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-muted-foreground text-xs">Compliance: {policy.compliance}%</div>
              {policy.effectiveDate && (
                <div className="text-muted-foreground text-xs">
                  Effective: {new Date(policy.effectiveDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function EmptyState({ type }: { type: string }) {
  const config = DATA_TYPE_CONFIG[type as keyof typeof DATA_TYPE_CONFIG];
  const Icon = config?.icon || AlertCircle;

  return (
    <div className="text-muted-foreground py-8 text-center">
      <Icon className="mx-auto mb-4 h-12 w-12 opacity-50" />
      <p>No {config?.label || type} data shared yet</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  trend,
  positive,
}: {
  label: string;
  value: string | number;
  trend?: number;
  positive?: boolean;
}) {
  return (
    <div className="bg-background/50 border-border/50 space-y-1 rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-xl font-bold">{value}</div>
        {trend !== undefined && (
          <span className={cn("text-xs", trend > 0 ? "text-green-500" : "text-red-500")}>
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
        {positive && <CheckCircle className="h-4 w-4 text-green-500" />}
      </div>
    </div>
  );
}
