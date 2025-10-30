"use client";

import React, { useState } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Progress } from "~/components/ui/progress";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  BarChart3,
  Users,
  Building,
  Factory,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  LineChart,
} from "lucide-react";
import { toast } from "sonner";
import type { PolicyCategory, EconomicPolicy } from "~/types/ixstats";

interface EconomicPolicyModalProps {
  children: React.ReactNode;
  mode?: "create" | "view";
  policyId?: string;
}

const POLICY_CATEGORIES = [
  {
    value: "fiscal",
    label: "Fiscal Policy",
    icon: DollarSign,
    description: "Government spending and taxation",
  },
  {
    value: "monetary",
    label: "Monetary Policy",
    icon: BarChart3,
    description: "Interest rates and money supply",
  },
  {
    value: "trade",
    label: "Trade Policy",
    icon: Building,
    description: "Import/export regulations",
  },
  {
    value: "investment",
    label: "Investment Policy",
    icon: TrendingUp,
    description: "Foreign and domestic investment",
  },
  {
    value: "labor",
    label: "Labor Policy",
    icon: Users,
    description: "Employment and workforce regulations",
  },
  {
    value: "infrastructure",
    label: "Infrastructure",
    icon: Factory,
    description: "Public works and development",
  },
];

const POLICY_STATUS_CONFIG = {
  draft: { color: "text-gray-600", bg: "bg-gray-100", label: "Draft" },
  proposed: { color: "text-blue-600", bg: "bg-blue-100", label: "Proposed" },
  under_review: { color: "text-yellow-600", bg: "bg-yellow-100", label: "Under Review" },
  approved: { color: "text-green-600", bg: "bg-green-100", label: "Approved" },
  rejected: { color: "text-red-600", bg: "bg-red-100", label: "Rejected" },
  implemented: { color: "text-purple-600", bg: "bg-purple-100", label: "Implemented" },
};

export function EconomicPolicyModal({
  children,
  mode = "create",
  policyId,
}: EconomicPolicyModalProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    impact: {
      gdpGrowthProjection: 0,
      unemploymentImpact: 0,
      inflationImpact: 0,
      budgetImpact: 0,
    },
    priority: "medium" as "low" | "medium" | "high" | "critical",
    timeframe: "medium_term" as "immediate" | "short_term" | "medium_term" | "long_term",
    estimatedCost: 0,
    expectedBenefit: "",
  });

  // Get country data for impact calculations
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  const { data: countryData } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );

  // Get existing policies for context
  const {
    data: policies,
    isLoading: policiesLoading,
    refetch,
  } = api.unifiedIntelligence.getEconomicPolicies.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId && open }
  );

  // Create policy mutation
  const createPolicy = api.unifiedIntelligence.createEconomicPolicy.useMutation({
    onSuccess: () => {
      toast.success("Economic policy created successfully!");
      setOpen(false);
      resetForm();
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create policy: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      impact: {
        gdpGrowthProjection: 0,
        unemploymentImpact: 0,
        inflationImpact: 0,
        budgetImpact: 0,
      },
      priority: "medium",
      timeframe: "medium_term",
      estimatedCost: 0,
      expectedBenefit: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.category || !formData.description.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    createPolicy.mutate({
      countryId: userProfile?.countryId || "",
      title: formData.title,
      description: formData.description,
      category: formData.category as PolicyCategory,
      impact: formData.impact,
      status: "draft",
      proposedBy: user?.fullName || user?.firstName || "Unknown User",
      proposedDate: new Date(),
    });
  };

  const calculateImpactScore = () => {
    const impacts = formData.impact;
    const gdpWeight = 0.4;
    const unemploymentWeight = 0.3;
    const inflationWeight = 0.2;
    const budgetWeight = 0.1;

    return Math.round(
      impacts.gdpGrowthProjection * gdpWeight +
        -impacts.unemploymentImpact * unemploymentWeight +
        -Math.abs(impacts.inflationImpact) * inflationWeight +
        impacts.budgetImpact * budgetWeight
    );
  };

  const activePolicies =
    policies?.filter(
      (p: EconomicPolicy) => p.status === "approved" || p.status === "implemented"
    ) || [];

  const pendingPolicies =
    policies?.filter(
      (p: EconomicPolicy) => p.status === "proposed" || p.status === "under_review"
    ) || [];

  const getCategoryIcon = (category: string) => {
    const categoryConfig = POLICY_CATEGORIES.find((cat) => cat.value === category);
    const IconComponent = categoryConfig?.icon || FileText;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        style={{
          width: "100vw",
          maxWidth: "100vw",
          height: "100vh",
          maxHeight: "100vh",
          padding: "24px",
          margin: "0px",
          overflowY: "auto",
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-500" />
            {mode === "create" ? "Create Economic Policy" : "Economic Policy Details"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Design and propose new economic policies with impact analysis."
              : "View and manage economic policy details and implementation."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={mode === "create" ? "create" : "overview"} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create">Create Policy</TabsTrigger>
            <TabsTrigger value="overview">Policy Overview</TabsTrigger>
            <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
            <TabsTrigger value="history">Policy History</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left Column - Basic Information */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Policy Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Infrastructure Investment Initiative"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Policy Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select policy category" />
                      </SelectTrigger>
                      <SelectContent>
                        {POLICY_CATEGORIES.map((category) => {
                          const IconComponent = category.icon;
                          return (
                            <SelectItem key={category.value} value={category.value}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{category.label}</div>
                                  <div className="text-muted-foreground text-xs">
                                    {category.description}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Policy Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Detailed description of the policy, its objectives, and implementation approach..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Priority Level</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            priority: value as "low" | "medium" | "high" | "critical",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low Priority</SelectItem>
                          <SelectItem value="medium">Medium Priority</SelectItem>
                          <SelectItem value="high">High Priority</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Implementation Timeframe</Label>
                      <Select
                        value={formData.timeframe}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            timeframe: value as
                              | "immediate"
                              | "short_term"
                              | "medium_term"
                              | "long_term",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate (0-3 months)</SelectItem>
                          <SelectItem value="short_term">Short Term (3-12 months)</SelectItem>
                          <SelectItem value="medium_term">Medium Term (1-3 years)</SelectItem>
                          <SelectItem value="long_term">Long Term (3+ years)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="expectedBenefit">Expected Benefits</Label>
                    <Textarea
                      id="expectedBenefit"
                      placeholder="Describe the expected benefits and outcomes..."
                      value={formData.expectedBenefit}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, expectedBenefit: e.target.value }))
                      }
                      rows={3}
                    />
                  </div>
                </div>

                {/* Right Column - Economic Impact */}
                <div className="space-y-4">
                  <GlassCard variant="economic">
                    <div className="p-6 pb-4">
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <LineChart className="h-5 w-5 text-blue-500" />
                        Economic Impact Projections
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Estimate the economic impact of this policy
                      </p>
                    </div>
                    <div className="space-y-4 p-6">
                      <div>
                        <Label htmlFor="gdpGrowth">GDP Growth Impact (%)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="gdpGrowth"
                            type="number"
                            step="0.1"
                            value={formData.impact.gdpGrowthProjection}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                impact: {
                                  ...prev.impact,
                                  gdpGrowthProjection: Number(e.target.value),
                                },
                              }))
                            }
                            className="flex-1"
                          />
                          {formData.impact.gdpGrowthProjection > 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : formData.impact.gdpGrowthProjection < 0 ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="unemploymentImpact">Unemployment Impact (%)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="unemploymentImpact"
                            type="number"
                            step="0.1"
                            value={formData.impact.unemploymentImpact}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                impact: {
                                  ...prev.impact,
                                  unemploymentImpact: Number(e.target.value),
                                },
                              }))
                            }
                            className="flex-1"
                          />
                          {formData.impact.unemploymentImpact < 0 ? (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          ) : formData.impact.unemploymentImpact > 0 ? (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Negative values indicate unemployment reduction
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="inflationImpact">Inflation Impact (%)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="inflationImpact"
                            type="number"
                            step="0.1"
                            value={formData.impact.inflationImpact}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                impact: { ...prev.impact, inflationImpact: Number(e.target.value) },
                              }))
                            }
                            className="flex-1"
                          />
                          {formData.impact.inflationImpact > 0 ? (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          ) : formData.impact.inflationImpact < 0 ? (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="budgetImpact">Budget Impact (Billions)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="budgetImpact"
                            type="number"
                            step="0.1"
                            value={formData.impact.budgetImpact}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                impact: { ...prev.impact, budgetImpact: Number(e.target.value) },
                              }))
                            }
                            className="flex-1"
                          />
                          <DollarSign className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Negative values indicate cost, positive indicate revenue
                        </p>
                      </div>

                      <Separator />

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label>Overall Impact Score</Label>
                          <Badge variant={calculateImpactScore() > 0 ? "default" : "destructive"}>
                            {calculateImpactScore() > 0
                              ? "Positive"
                              : calculateImpactScore() < 0
                                ? "Negative"
                                : "Neutral"}
                          </Badge>
                        </div>
                        <Progress
                          value={Math.max(0, Math.min(100, calculateImpactScore() + 50))}
                          className="h-2"
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                          Score:{" "}
                          <NumberFlowDisplay
                            value={calculateImpactScore()}
                            decimalPlaces={0}
                            className="inline"
                          />{" "}
                          (based on weighted economic factors)
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  {countryData && (
                    <GlassCard variant="economic">
                      <div className="p-6 pb-4">
                        <h3 className="text-sm font-semibold">Current Economic Context</h3>
                      </div>
                      <div className="space-y-2 p-6 text-sm">
                        <div className="flex justify-between">
                          <span>Current GDP:</span>
                          <span className="font-medium">
                            $
                            <NumberFlowDisplay
                              value={countryData.currentTotalGdp / 1e12}
                              decimalPlaces={2}
                              className="inline"
                            />
                            T
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>GDP per Capita:</span>
                          <span className="font-medium">
                            $
                            <NumberFlowDisplay
                              value={countryData.currentGdpPerCapita}
                              decimalPlaces={0}
                              className="inline"
                            />
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Economic Tier:</span>
                          <Badge variant="outline">{countryData.economicTier}</Badge>
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPolicy.isPending}>
                  {createPolicy.isPending ? "Creating..." : "Create Policy"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-6">
              {policiesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              ) : (
                <>
                  {/* Active Policies */}
                  <GlassCard variant="economic">
                    <div className="p-6 pb-4">
                      <h3 className="flex items-center gap-2 font-semibold">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Active Policies
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Currently approved and implemented policies
                      </p>
                    </div>
                    <div className="p-6">
                      {activePolicies.length > 0 ? (
                        <div className="space-y-3">
                          {activePolicies.map((policy: EconomicPolicy) => (
                            <div key={policy.id} className="rounded-lg border p-4">
                              <div className="mb-2 flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {getCategoryIcon(policy.category)}
                                  <h4 className="font-semibold">{policy.title}</h4>
                                </div>
                                <Badge
                                  className={`${POLICY_STATUS_CONFIG[policy.status as keyof typeof POLICY_STATUS_CONFIG]?.bg} ${POLICY_STATUS_CONFIG[policy.status as keyof typeof POLICY_STATUS_CONFIG]?.color}`}
                                >
                                  {
                                    POLICY_STATUS_CONFIG[
                                      policy.status as keyof typeof POLICY_STATUS_CONFIG
                                    ]?.label
                                  }
                                </Badge>
                              </div>
                              <p className="text-muted-foreground mb-2 text-sm">
                                {policy.description}
                              </p>
                              <div className="text-muted-foreground flex gap-4 text-xs">
                                <span>
                                  Category:{" "}
                                  {
                                    POLICY_CATEGORIES.find((c) => c.value === policy.category)
                                      ?.label
                                  }
                                </span>
                                <span>
                                  Proposed: {new Date(policy.proposedDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground py-8 text-center">
                          <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                          <p>No active policies</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* Pending Policies */}
                  <GlassCard variant="economic">
                    <div className="p-6 pb-4">
                      <h3 className="flex items-center gap-2 font-semibold">
                        <Clock className="h-5 w-5 text-yellow-500" />
                        Pending Policies
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Policies awaiting review or approval
                      </p>
                    </div>
                    <div className="p-6">
                      {pendingPolicies.length > 0 ? (
                        <div className="space-y-3">
                          {pendingPolicies.map((policy: EconomicPolicy) => (
                            <div key={policy.id} className="rounded-lg border p-4">
                              <div className="mb-2 flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {getCategoryIcon(policy.category)}
                                  <h4 className="font-semibold">{policy.title}</h4>
                                </div>
                                <Badge variant="outline">
                                  {
                                    POLICY_STATUS_CONFIG[
                                      policy.status as keyof typeof POLICY_STATUS_CONFIG
                                    ]?.label
                                  }
                                </Badge>
                              </div>
                              <p className="text-muted-foreground mb-2 text-sm">
                                {policy.description}
                              </p>
                              <div className="text-muted-foreground flex gap-4 text-xs">
                                <span>
                                  Category:{" "}
                                  {
                                    POLICY_CATEGORIES.find((c) => c.value === policy.category)
                                      ?.label
                                  }
                                </span>
                                <span>
                                  Proposed: {new Date(policy.proposedDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground py-8 text-center">
                          <Clock className="mx-auto mb-4 h-12 w-12 opacity-50" />
                          <p>No pending policies</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* Policy Statistics */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <GlassCard variant="economic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {activePolicies.length}
                        </div>
                        <div className="text-muted-foreground text-sm">Active</div>
                      </div>
                    </GlassCard>
                    <GlassCard variant="economic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {pendingPolicies.length}
                        </div>
                        <div className="text-muted-foreground text-sm">Pending</div>
                      </div>
                    </GlassCard>
                    <GlassCard variant="economic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {policies?.length || 0}
                        </div>
                        <div className="text-muted-foreground text-sm">Total</div>
                      </div>
                    </GlassCard>
                    <GlassCard variant="economic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {new Set(policies?.map((p: EconomicPolicy) => p.category)).size || 0}
                        </div>
                        <div className="text-muted-foreground text-sm">Categories</div>
                      </div>
                    </GlassCard>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="impact" className="mt-6">
            <GlassCard variant="economic">
              <div className="p-6 pb-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Target className="h-5 w-5 text-purple-500" />
                  Economic Impact Analysis
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Analyze the economic impact of your policy proposals
                </p>
              </div>
              <div className="p-6">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Economic impact analysis tools are being developed. This will include detailed
                    projections, scenario modeling, and comparative analysis with historical policy
                    impacts.
                  </AlertDescription>
                </Alert>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <GlassCard variant="economic">
              <div className="p-6 pb-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Briefcase className="h-5 w-5 text-orange-500" />
                  Policy History
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Complete history of all economic policies
                </p>
              </div>
              <div className="p-6">
                {policiesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : policies && policies.length > 0 ? (
                  <div className="space-y-3">
                    {policies.map((policy: EconomicPolicy) => (
                      <div key={policy.id} className="rounded-lg border p-4">
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(policy.category)}
                            <h4 className="font-semibold">{policy.title}</h4>
                          </div>
                          <Badge
                            className={`${POLICY_STATUS_CONFIG[policy.status as keyof typeof POLICY_STATUS_CONFIG]?.bg} ${POLICY_STATUS_CONFIG[policy.status as keyof typeof POLICY_STATUS_CONFIG]?.color}`}
                          >
                            {
                              POLICY_STATUS_CONFIG[
                                policy.status as keyof typeof POLICY_STATUS_CONFIG
                              ]?.label
                            }
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-2 text-sm">{policy.description}</p>
                        <div className="text-muted-foreground flex gap-4 text-xs">
                          <span>
                            Category:{" "}
                            {POLICY_CATEGORIES.find((c) => c.value === policy.category)?.label}
                          </span>
                          <span>Proposed by: {policy.proposedBy}</span>
                          <span>Date: {new Date(policy.proposedDate).toLocaleDateString()}</span>
                        </div>
                        {policy.impact && (
                          <div className="mt-2 text-xs">
                            <span className="font-medium">Impact:</span>
                            {policy.impact.gdpGrowthProjection !== undefined &&
                              policy.impact.gdpGrowthProjection !== 0 && (
                                <span className="ml-2">
                                  GDP: {policy.impact.gdpGrowthProjection > 0 ? "+" : ""}
                                  {policy.impact.gdpGrowthProjection}%
                                </span>
                              )}
                            {policy.impact.unemploymentImpact !== undefined &&
                              policy.impact.unemploymentImpact !== 0 && (
                                <span className="ml-2">
                                  Unemployment: {policy.impact.unemploymentImpact > 0 ? "+" : ""}
                                  {policy.impact.unemploymentImpact}%
                                </span>
                              )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <Briefcase className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No policy history available</p>
                    <p className="text-sm">Create your first economic policy to get started</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
