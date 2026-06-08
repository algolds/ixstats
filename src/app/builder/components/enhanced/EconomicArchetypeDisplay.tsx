"use client";

import React, { useState, memo, useMemo } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import {
  Globe,
  TrendingUp,
  Lightbulb,
  Users,
  Building2,
  Target,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  RefreshCw,
  Cpu,
  Mountain,
  Factory,
  Leaf,
  Banknote,
  Crown,
  Ship,
  Car,
  Wrench,
  Hammer,
  Gavel,
  BookOpen,
  TreePine,
  Wheat,
  Pickaxe,
  Building,
  Landmark,
  Coins,
  Search,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import type { EconomicArchetype } from "~/app/builder/data/archetype-types";
import type { EconomyBuilderState } from "~/types/economy-builder";
import { useArchetypes } from "~/hooks/useArchetypes";
import { modernArchetypes } from "~/app/builder/data/archetypes/modern";

interface EconomicArchetypeDisplayProps {
  className?: string;
  currentState?: EconomyBuilderState;
  onArchetypeApplied?: (
    newState: EconomyBuilderState,
    archetypeId?: string,
    archetype?: EconomicArchetype
  ) => void;
  era?: "modern" | "historical" | "all";
}

// Phase 2 optimization: Wrap with React.memo to prevent unnecessary re-renders
export const EconomicArchetypeDisplay = memo(function EconomicArchetypeDisplay({
  className,
  currentState,
  onArchetypeApplied,
  era = "all",
}: EconomicArchetypeDisplayProps) {
  const [selectedArchetype, setSelectedArchetype] = useState<EconomicArchetype | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("modern");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch archetypes from database with fallback
  const { archetypes } = useArchetypes(era);

  const [searchQuery, setSearchQuery] = useState("");
  const [complexityFilter, setComplexityFilter] = useState<string>("all");

  const filteredArchetypes = useMemo(() => {
    return (archetypes || []).filter((archetype) => {
      // 1. Filter by Active Tab (modern vs historical)
      const archetypeEra =
        (archetype as any).era || (modernArchetypes.has(archetype.id) ? "modern" : "historical");
      if (archetypeEra !== activeTab) {
        return false;
      }

      // 2. Search Query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = archetype.name?.toLowerCase().includes(query);
        const matchesDesc = archetype.description?.toLowerCase().includes(query);
        const matchesRegion = archetype.region?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesRegion) {
          return false;
        }
      }

      // 3. Complexity Filter
      if (complexityFilter !== "all") {
        if (archetype.implementationComplexity !== complexityFilter) {
          return false;
        }
      }

      return true;
    });
  }, [archetypes, searchQuery, complexityFilter, activeTab]);

  const handleApplyArchetype = () => {
    if (!selectedArchetype) return;

    setIsLoading(true);
    try {
      // Get archetype ID (prefer id over key for database tracking)
      const archetypeId = (selectedArchetype as any).id || selectedArchetype.id;

      // Apply archetype to current state
      onArchetypeApplied?.(currentState as any, archetypeId, selectedArchetype);

      // Show success message
      setIsDetailsOpen(false);
      setSelectedArchetype(null);
    } catch (error) {
      console.error("Failed to apply archetype:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getComplexityColor = (complexity: "low" | "medium" | "high") => {
    switch (complexity) {
      case "low":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
      case "high":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  };

  const getArchetypeIcon = (archetypeId: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      "silicon-valley": Cpu,
      nordic: Leaf,
      "asian-tiger": Factory,
      "german-social-market": Building2,
      singapore: Banknote,
      swiss: Mountain,
      japanese: Car,
      australian: Pickaxe,
      brazilian: Wheat,
      canadian: TreePine,
      "british-empire": Crown,
      "venetian-republic": Ship,
      "hanseatic-league": Globe,
      "dutch-golden-age": Banknote,
      "industrial-revolution": Wrench,
      "soviet-command": Hammer,
      "american-gilded-age": Building,
      "french-mercantilism": Gavel,
      "ottoman-empire": Landmark,
      "chinese-ming-dynasty": BookOpen,
    };
    return iconMap[archetypeId] || Globe;
  };

  const getArchetypeColors = (archetypeId: string) => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      "silicon-valley": {
        bg: "from-blue-500 to-purple-600",
        border: "border-blue-200/50 dark:border-blue-800/50",
        text: "text-blue-600 dark:text-blue-400",
      },
      nordic: {
        bg: "from-green-500 to-emerald-600",
        border: "border-green-200/50 dark:border-green-800/50",
        text: "text-emerald-600 dark:text-emerald-400",
      },
      "asian-tiger": {
        bg: "from-orange-500 to-red-600",
        border: "border-orange-200/50 dark:border-orange-800/50",
        text: "text-orange-600 dark:text-orange-400",
      },
      "german-social-market": {
        bg: "from-gray-500 to-slate-600",
        border: "border-gray-200/50 dark:border-gray-800/50",
        text: "text-zinc-600 dark:text-zinc-400",
      },
      singapore: {
        bg: "from-cyan-500 to-blue-600",
        border: "border-cyan-200/50 dark:border-cyan-800/50",
        text: "text-cyan-600 dark:text-cyan-400",
      },
      swiss: {
        bg: "from-red-500 to-white",
        border: "border-red-200/50 dark:border-red-800/50",
        text: "text-red-600 dark:text-red-400",
      },
      japanese: {
        bg: "from-red-500 to-pink-600",
        border: "border-red-200/50 dark:border-red-800/50",
        text: "text-rose-600 dark:text-rose-400",
      },
      australian: {
        bg: "from-yellow-500 to-orange-600",
        border: "border-yellow-200/50 dark:border-yellow-800/50",
        text: "text-amber-600 dark:text-amber-400",
      },
      brazilian: {
        bg: "from-green-500 to-yellow-600",
        border: "border-green-200/50 dark:border-green-800/50",
        text: "text-emerald-600 dark:text-emerald-400",
      },
      canadian: {
        bg: "from-red-500 to-white",
        border: "border-red-200/50 dark:border-red-800/50",
        text: "text-rose-600 dark:text-rose-400",
      },
      "british-empire": {
        bg: "from-blue-500 to-red-600",
        border: "border-blue-200/50 dark:border-blue-800/50",
        text: "text-blue-600 dark:text-blue-400",
      },
      "venetian-republic": {
        bg: "from-blue-500 to-cyan-600",
        border: "border-blue-200/50 dark:border-blue-800/50",
        text: "text-cyan-600 dark:text-cyan-400",
      },
      "hanseatic-league": {
        bg: "from-gray-500 to-blue-600",
        border: "border-gray-200/50 dark:border-gray-800/50",
        text: "text-zinc-600 dark:text-zinc-400",
      },
      "dutch-golden-age": {
        bg: "from-orange-500 to-white",
        border: "border-orange-200/50 dark:border-orange-800/50",
        text: "text-orange-600 dark:text-orange-400",
      },
      "industrial-revolution": {
        bg: "from-gray-500 to-black",
        border: "border-gray-200/50 dark:border-gray-800/50",
        text: "text-zinc-500",
      },
      "soviet-command": {
        bg: "from-red-500 to-yellow-600",
        border: "border-red-200/50 dark:border-red-800/50",
        text: "text-red-600 dark:text-red-400",
      },
      "american-gilded-age": {
        bg: "from-yellow-500 to-gray-600",
        border: "border-yellow-200/50 dark:border-yellow-800/50",
        text: "text-amber-600 dark:text-amber-400",
      },
      "french-mercantilism": {
        bg: "from-blue-500 to-white",
        border: "border-blue-200/50 dark:border-blue-800/50",
        text: "text-blue-600 dark:text-blue-400",
      },
      "ottoman-empire": {
        bg: "from-red-500 to-green-600",
        border: "border-red-200/50 dark:border-red-800/50",
        text: "text-red-600 dark:text-red-400",
      },
      "chinese-ming-dynasty": {
        bg: "from-red-500 to-yellow-600",
        border: "border-red-200/50 dark:border-red-800/50",
        text: "text-amber-600 dark:text-amber-400",
      },
    };
    return (
      colorMap[archetypeId] || {
        bg: "from-blue-500 to-purple-600",
        border: "border-blue-200/50 dark:border-blue-800/50",
        text: "text-blue-600 dark:text-blue-400",
      }
    );
  };

  const renderArchetypeCard = (archetype: EconomicArchetype, showSelectButton: boolean = false) => {
    const IconComponent = getArchetypeIcon(archetype.id);
    const colors = getArchetypeColors(archetype.id);

    return (
      <div key={archetype.id} className="group">
        <div className="border-border bg-card/40 flex h-full flex-col justify-between gap-4 rounded-xl border p-5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-emerald-500/[0.01] hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/[0.03]">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-muted/50 border-border shrink-0 rounded-lg border p-2.5">
                <IconComponent className={cn("h-5 w-5", colors.text)} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-foreground truncate text-sm leading-tight font-bold">
                  {archetype.name}
                </h4>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                  <Globe className="text-muted-foreground/75 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-medium">{archetype.region}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Badge
                className={cn(
                  getComplexityColor(archetype.implementationComplexity),
                  "shrink-0 px-2 py-0.5 text-[10px] font-medium capitalize"
                )}
              >
                {archetype.implementationComplexity}
              </Badge>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Innovation: {archetype.growthMetrics.innovationIndex}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-border/50 flex items-center gap-2 border-t pt-2.5">
            {showSelectButton && (
              <Button
                onClick={() => {
                  setSelectedArchetype(archetype);
                  handleApplyArchetype();
                }}
                className="h-8 flex-1 cursor-pointer bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                size="sm"
              >
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Select
              </Button>
            )}
            <Button
              onClick={() => {
                setSelectedArchetype(archetype);
                setIsDetailsOpen(true);
              }}
              variant="outline"
              className="border-border hover:bg-accent hover:text-accent-foreground h-8 flex-1 cursor-pointer text-xs"
              size="sm"
            >
              <Info className="mr-1.5 h-3.5 w-3.5" />
              Details
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderArchetypeDetails = () => {
    if (!selectedArchetype) return null;

    return (
      <div className="text-foreground space-y-6">
        <div className="border-border flex flex-col items-start justify-between gap-4 border-b pb-6 lg:flex-row">
          <div className="flex-1 space-y-2">
            <h2 className="text-foreground text-3xl font-bold tracking-tight">
              {selectedArchetype.name}
            </h2>
            <p className="text-muted-foreground max-w-4xl text-sm leading-relaxed">
              {selectedArchetype.description}
            </p>
            <div className="text-muted-foreground flex items-center gap-2 pt-1 text-sm">
              <Globe className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium">{selectedArchetype.region}</span>
            </div>
          </div>
          <Button
            onClick={handleApplyArchetype}
            disabled={isLoading}
            className="flex h-11 w-full shrink-0 cursor-pointer items-center gap-2 self-center bg-emerald-600 px-6 font-semibold text-white shadow-lg shadow-emerald-500/10 hover:bg-emerald-700 lg:w-auto dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Applying Preset...</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                <span>Apply Archetype Preset</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {/* Growth Metrics */}
          <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
            <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Growth Metrics
            </h3>
            <div className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">GDP Growth</span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.growthMetrics.gdpGrowth}%
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.growthMetrics.gdpGrowth * 10}
                  className="bg-secondary h-2"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">
                    Innovation Index
                  </span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.growthMetrics.innovationIndex}
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.growthMetrics.innovationIndex}
                  className="bg-secondary h-2"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Competitiveness</span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.growthMetrics.competitiveness}
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.growthMetrics.competitiveness}
                  className="bg-secondary h-2"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Stability</span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.growthMetrics.stability}
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.growthMetrics.stability}
                  className="bg-secondary h-2"
                />
              </div>
            </div>
          </div>

          {/* Employment Profile */}
          <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
            <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              Employment Profile
            </h3>
            <div className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">
                    Unemployment Rate
                  </span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.employmentProfile.unemploymentRate}%
                  </span>
                </div>
                <Progress
                  value={100 - selectedArchetype.employmentProfile.unemploymentRate * 10}
                  className="bg-secondary h-2"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">
                    Labor Participation
                  </span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.employmentProfile.laborParticipation}%
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.employmentProfile.laborParticipation}
                  className="bg-secondary h-2"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Wage Growth</span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.employmentProfile.wageGrowth}%
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.employmentProfile.wageGrowth * 20}
                  className="bg-secondary h-2"
                />
              </div>
            </div>
          </div>

          {/* Tax Profile */}
          <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
            <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2">
                <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              Tax Profile
            </h3>
            <div className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Corporate Tax</span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.taxProfile.corporateRate}%
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.taxProfile.corporateRate * 2}
                  className="bg-secondary h-2"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Income Tax</span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.taxProfile.incomeRate}%
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.taxProfile.incomeRate * 1.5}
                  className="bg-secondary h-2"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Consumption Tax</span>
                  <span className="text-foreground text-sm font-semibold">
                    {selectedArchetype.taxProfile.consumptionRate}%
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.taxProfile.consumptionRate * 3}
                  className="bg-secondary h-2"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">
                    Revenue Efficiency
                  </span>
                  <span className="text-foreground text-sm font-semibold">
                    {Math.round(selectedArchetype.taxProfile.revenueEfficiency * 100)}%
                  </span>
                </div>
                <Progress
                  value={selectedArchetype.taxProfile.revenueEfficiency * 100}
                  className="bg-secondary h-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Components (Government & Economy) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Government Components */}
          <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
            <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              Government Components
            </h3>
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedArchetype.governmentComponents &&
              selectedArchetype.governmentComponents.length > 0 ? (
                selectedArchetype.governmentComponents.map((comp, idx) => (
                  <Badge
                    key={`gov-comp-${idx}`}
                    variant="outline"
                    className="border-blue-500/20 bg-blue-500/5 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                  >
                    {comp && typeof comp === "string"
                      ? comp.replace(/_/g, " ")
                      : (comp as any)?.name || (comp as any)?.componentType || ""}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-xs italic">
                  No default government components
                </span>
              )}
            </div>
          </div>

          {/* Economic Components */}
          <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
            <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Economic Components
            </h3>
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedArchetype.economicComponents &&
              selectedArchetype.economicComponents.length > 0 ? (
                selectedArchetype.economicComponents.map((comp, idx) => (
                  <Badge
                    key={`econ-comp-${idx}`}
                    variant="outline"
                    className="border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    {comp && typeof comp === "string"
                      ? comp.replace(/_/g, " ")
                      : (comp as any)?.name || (comp as any)?.componentType || ""}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-xs italic">
                  No default economic components
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Strengths */}
          <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
            <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Key Strengths
            </h3>
            <div className="pt-2">
              <ul className="space-y-2.5">
                {selectedArchetype.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-foreground text-sm leading-relaxed">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Challenges */}
          <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
            <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              Key Challenges
            </h3>
            <div className="pt-2">
              <ul className="space-y-2.5">
                {selectedArchetype.challenges.map((challenge, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span className="text-foreground text-sm leading-relaxed">{challenge}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
          <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            Implementation Recommendations
          </h3>
          <div className="grid grid-cols-1 gap-3 pt-2 lg:grid-cols-2">
            {selectedArchetype.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 font-bold text-emerald-600 dark:text-emerald-400">
                  •
                </span>
                <span className="text-muted-foreground text-sm leading-relaxed">{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Historical Context */}
        <div className="border-border bg-card/30 space-y-4 rounded-xl border p-5">
          <h3 className="text-foreground flex items-center gap-2.5 text-base font-bold">
            <div className="rounded-lg border border-teal-500/20 bg-teal-500/10 p-2">
              <Info className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            Historical Context & Real-world Examples
          </h3>
          <div className="space-y-5 pt-2">
            <div>
              <h4 className="text-foreground mb-2 text-sm font-semibold">Historical Context</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {selectedArchetype.historicalContext}
              </p>
            </div>
            <div className="border-border border-t pt-4">
              <h4 className="text-foreground mb-2.5 text-sm font-semibold">
                Modern Country Examples
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedArchetype.modernExamples.map((example, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="border-border bg-muted/50 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                  >
                    {example}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 border-border grid h-11 w-full grid-cols-2 rounded-xl border p-1">
          <TabsTrigger
            value="modern"
            className="text-muted-foreground cursor-pointer rounded-lg text-sm font-medium transition-all data-[state=active]:bg-emerald-600/10 data-[state=active]:font-semibold data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-500/15 dark:data-[state=active]:text-emerald-400"
          >
            Economy Presets
          </TabsTrigger>
          <TabsTrigger
            value="historical"
            className="text-muted-foreground cursor-pointer rounded-lg text-sm font-medium transition-all data-[state=active]:bg-emerald-600/10 data-[state=active]:font-semibold data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-500/15 dark:data-[state=active]:text-emerald-400"
          >
            Government Presets
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-6">
          {archetypes.length > 0 && (
            <div className="border-border/40 bg-card/10 flex flex-col gap-4 rounded-xl border p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search Input */}
                <div className="relative max-w-md flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search archetypes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background/30 border-border/50 pr-4 pl-9 text-sm"
                  />
                </div>

                {/* Complexity Filter */}
                <Select value={complexityFilter} onValueChange={setComplexityFilter}>
                  <SelectTrigger className="bg-background/30 border-border/50 w-full sm:w-44">
                    <SelectValue placeholder="Select Complexity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Complexities</SelectItem>
                    <SelectItem value="low">Low Complexity</SelectItem>
                    <SelectItem value="medium">Medium Complexity</SelectItem>
                    <SelectItem value="high">High Complexity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Counter */}
              <div className="text-muted-foreground shrink-0 text-xs font-semibold">
                Showing {filteredArchetypes.length} of {archetypes.filter(a => {
                  const archetypeEra = (a as any).era || (modernArchetypes.has(a.id) ? "modern" : "historical");
                  return archetypeEra === activeTab;
                }).length}
              </div>
            </div>
          )}

          {archetypes.length === 0 ? (
            <div className="border-border bg-card/25 rounded-xl border-2 border-dashed p-16 text-center">
              <div className="space-y-4">
                <div className="bg-muted border-border mx-auto w-fit rounded-full border p-4">
                  <Target className="text-muted-foreground h-8 w-8" />
                </div>
                <h3 className="text-foreground text-lg font-semibold">No Archetypes Available</h3>
                <p className="text-muted-foreground mx-auto max-w-md text-sm">
                  Economic archetypes are being loaded. If this persists, contact the administrator.
                </p>
              </div>
            </div>
          ) : filteredArchetypes.length === 0 ? (
            <div className="border-border bg-card/25 rounded-xl border-2 border-dashed p-16 text-center">
              <div className="space-y-4">
                <div className="bg-muted border-border mx-auto w-fit rounded-full border p-4">
                  <Target className="text-muted-foreground h-8 w-8" />
                </div>
                <h3 className="text-foreground text-lg font-semibold">No Matching Archetypes</h3>
                <p className="text-muted-foreground mx-auto max-w-md text-sm">
                  No archetypes match your current search and filter settings. Try clearing them.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredArchetypes.map((archetype: any) =>
                renderArchetypeCard(archetype as EconomicArchetype, true)
              )}
            </div>
          )}
        </div>
      </Tabs>

      {/* Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="border-border/60 bg-background/95 text-foreground flex max-h-[85vh] w-full max-w-5xl flex-col gap-0 border p-0 shadow-2xl backdrop-blur-3xl dark:shadow-emerald-950/20">
          <DialogHeader className="border-border/40 shrink-0 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <DialogTitle className="text-foreground text-xl font-bold">
              {selectedArchetype?.name} Preset Details
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {selectedArchetype && renderArchetypeDetails()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

// Display name for debugging
EconomicArchetypeDisplay.displayName = "EconomicArchetypeDisplay";
