"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ComponentType } from "@prisma/client";
import {
  Settings,
  Lightbulb,
  BarChart3,
  Users,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RefreshCw,
  Crown,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { GlassCard, GlassCardContent, GlassCardHeader } from "../glass/GlassCard";

// Import atomic components
import { AtomicComponentSelector } from "~/components/government/atoms/AtomicGovernmentComponents";
import { AtomicImpactPreview } from "~/components/atomic/AtomicImpactPreview";
import { SmartRecommendations } from "~/components/atomic/SmartRecommendations";

// Import state management
import {
  AtomicBuilderStateManager,
  type AtomicBuilderState,
  type BuilderMode,
} from "~/lib/atomic-builder-state";
import type { CountryProfile } from "~/lib/atomic-recommendations";

// Import existing builder components for hybrid mode
import type { EconomicInputs, RealCountryData } from "../../lib/economy-data-service";

interface AtomicBuilderPageNativeProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
  initialComponents?: ComponentType[];
}

const BUILDER_MODES: Record<
  BuilderMode,
  { name: string; description: string; icon: React.ReactNode }
> = {
  atomic: {
    name: "Atomic First",
    description: "Build using atomic components as the primary approach",
    icon: <Settings className="h-4 w-4" />,
  },
  traditional: {
    name: "Traditional",
    description: "Classic government structure builder",
    icon: <Users className="h-4 w-4" />,
  },
  hybrid: {
    name: "Hybrid",
    description: "Combine atomic components with traditional structure",
    icon: <BarChart3 className="h-4 w-4" />,
  },
};

export function AtomicBuilderPageNative({
  inputs,
  referenceCountry,
  onInputsChange,
  onPreview,
  onBack,
  initialComponents = [],
}: AtomicBuilderPageNativeProps) {
  // State management
  const [stateManager] = useState(
    () =>
      new AtomicBuilderStateManager({
        selectedComponents: initialComponents,
        builderMode: "atomic",
      })
  );

  const [builderState, setBuilderState] = useState<AtomicBuilderState>(stateManager.getState());
  const [isRealTimeUpdates, setIsRealTimeUpdates] = useState(true);

  // Track initialization to prevent re-subscription loops
  const isInitializedRef = useRef(false);

  // Subscribe to state changes once
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      const unsubscribe = stateManager.subscribe(setBuilderState);
      return unsubscribe;
    }
  }, []); // Empty deps - subscribe once only

  // Generate country profile from inputs and reference country
  const countryProfile: CountryProfile = useMemo(() => {
    const population = inputs.coreIndicators.totalPopulation;
    const gdp = inputs.coreIndicators.nominalGDP;

    // Determine country size
    let size: "small" | "medium" | "large" = "medium";
    if (population < 10000000) size = "small";
    else if (population > 100000000) size = "large";

    // Determine development level based on GDP per capita
    const gdpPerCapita = gdp / population;
    let developmentLevel: "developing" | "emerging" | "developed" = "emerging";
    if (gdpPerCapita < 5000) developmentLevel = "developing";
    else if (gdpPerCapita > 25000) developmentLevel = "developed";

    // Infer political tradition (simplified logic)
    let politicalTradition: "democratic" | "authoritarian" | "mixed" | "traditional" = "mixed";
    if (referenceCountry.governmentType?.toLowerCase().includes("democracy")) {
      politicalTradition = "democratic";
    }

    // Generate challenges based on country data
    const challenges: Array<{
      type: "economic_growth" | "political_stability" | "corruption" | "inequality" | "development";
      severity: "low" | "medium" | "high";
    }> = [];

    if (gdpPerCapita < 10000) {
      challenges.push({ type: "economic_growth", severity: "high" });
    }
    if (developmentLevel === "developing") {
      challenges.push({ type: "development", severity: "high" });
    }
    if (inputs.coreIndicators.giniCoefficient && inputs.coreIndicators.giniCoefficient > 40) {
      challenges.push({ type: "inequality", severity: "medium" });
    }

    return {
      size,
      developmentLevel,
      politicalTradition,
      economicSystem: "mixed" as const,
      culturalContext: "mixed" as const,
      primaryChallenges: challenges,
      gdp,
      population,
    };
  }, [inputs, referenceCountry]);

  // Handle component changes
  const handleComponentChange = (components: ComponentType[]) => {
    stateManager.setSelectedComponents(components);

    // Update inputs with atomic component data if needed
    if (onInputsChange && isRealTimeUpdates) {
      const updatedInputs = {
        ...inputs,
        // You could map atomic components to existing input fields here
        // For now, we'll just track the components separately
      };
      onInputsChange(updatedInputs);
    }
  };

  const handleComponentAdd = (component: ComponentType) => {
    stateManager.addComponent(component);
  };

  const handleModeChange = (mode: BuilderMode) => {
    stateManager.setBuilderMode(mode);
  };

  const handleReset = () => {
    stateManager.setSelectedComponents([]);
  };

  const {
    selectedComponents,
    effectivenessScore,
    synergies,
    conflicts,
    economicImpact,
    builderMode,
  } = builderState;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 p-4 md:p-6 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="mx-auto max-w-[1800px]">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="rounded-lg p-2 transition-colors hover:bg-white/10"
                title="Back to builder"
              >
                <ArrowLeft className="text-muted-foreground h-5 w-5" />
              </button>

              <div>
                <h1 className="text-foreground flex items-center space-x-2 text-2xl font-bold">
                  <div className="rounded-lg bg-gradient-to-r from-purple-100 to-blue-100 p-2">
                    <Crown className="h-6 w-6 text-purple-600" />
                  </div>
                  <span>Atomic Government Builder</span>
                </h1>
                <p className="text-muted-foreground">
                  Build your government using atomic components with real-time impact analysis
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Real-time updates toggle */}
              <button
                onClick={() => setIsRealTimeUpdates(!isRealTimeUpdates)}
                className={cn(
                  "flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  isRealTimeUpdates
                    ? "border border-green-200 bg-green-100 text-green-700"
                    : "border border-gray-200 bg-gray-100 text-gray-600"
                )}
              >
                {isRealTimeUpdates ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                <span>Real-time</span>
              </button>

              {/* Reset button */}
              <button
                onClick={handleReset}
                className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-100"
                disabled={selectedComponents.length === 0}
              >
                <RefreshCw className="h-3 w-3" />
                <span>Reset</span>
              </button>

              {/* Preview button */}
              <button
                onClick={onPreview}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center space-x-2 rounded-lg px-4 py-2 transition-colors"
              >
                <span>Preview Country</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Builder Mode Selection */}
          <div className="mb-4 flex items-center space-x-2">
            <span className="text-muted-foreground text-sm font-medium">Builder Mode:</span>
            <div className="flex space-x-1">
              {Object.entries(BUILDER_MODES).map(([mode, config]) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode as BuilderMode)}
                  className={cn(
                    "flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                    builderMode === mode
                      ? "bg-primary/10 text-primary border-primary/20 border"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {config.icon}
                  <span>{config.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Component Selection - Left Panel */}
          <div className="xl:col-span-5">
            <GlassCard depth="elevated" blur="medium" motionPreset="slide">
              <GlassCardHeader>
                <div className="flex items-center space-x-2">
                  <Settings className="text-primary h-5 w-5" />
                  <h2 className="font-semibold">Component Selection</h2>
                  <span className="text-muted-foreground text-xs">
                    ({selectedComponents.length}/25 selected)
                  </span>
                </div>
              </GlassCardHeader>
              <GlassCardContent>
                <AtomicComponentSelector
                  initialComponents={selectedComponents}
                  onChange={handleComponentChange}
                />
              </GlassCardContent>
            </GlassCard>
          </div>

          {/* Impact Preview - Center Panel */}
          <div className="xl:col-span-4">
            <GlassCard depth="elevated" blur="medium" motionPreset="slide">
              <GlassCardHeader>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  <h2 className="font-semibold">Live Impact Analysis</h2>
                  <div className="ml-auto text-right">
                    <div className="text-primary text-lg font-bold">
                      {effectivenessScore.toFixed(0)}%
                    </div>
                    <div className="text-muted-foreground text-xs">Effectiveness</div>
                  </div>
                </div>
              </GlassCardHeader>
              <GlassCardContent>
                <AtomicImpactPreview
                  selectedComponents={selectedComponents}
                  economicImpact={economicImpact}
                  effectivenessScore={effectivenessScore}
                  synergyCount={synergies.length}
                  conflictCount={conflicts.length}
                  className="h-[600px] overflow-y-auto"
                />
              </GlassCardContent>
            </GlassCard>
          </div>

          {/* Smart Recommendations - Right Panel */}
          <div className="xl:col-span-3">
            <GlassCard depth="elevated" blur="medium" motionPreset="slide">
              <GlassCardHeader>
                <div className="flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-purple-600" />
                  <h2 className="font-semibold">AI Recommendations</h2>
                </div>
              </GlassCardHeader>
              <GlassCardContent>
                <SmartRecommendations
                  selectedComponents={selectedComponents}
                  countryProfile={countryProfile}
                  onComponentAdd={handleComponentAdd}
                  maxRecommendations={6}
                  className="h-[600px] overflow-y-auto"
                />
              </GlassCardContent>
            </GlassCard>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <motion.div
          className="mt-6 rounded-lg border border-white/20 bg-white/50 p-4 backdrop-blur-sm dark:bg-slate-800/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span>
                  <span className="font-medium">{synergies.length}</span> Active Synergies
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <span>
                  <span className="font-medium">{conflicts.length}</span> Conflicts
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                <span>
                  <span className="font-medium">
                    {((economicImpact.gdpImpact.current - 1) * 100).toFixed(1)}%
                  </span>{" "}
                  GDP Impact
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                <span>
                  <span className="font-medium">
                    {economicImpact.stabilityIndex.current.toFixed(0)}
                  </span>{" "}
                  Stability
                </span>
              </div>
            </div>

            <div className="text-muted-foreground flex items-center space-x-2 text-sm">
              <span>Country Profile:</span>
              <span className="capitalize">{countryProfile.size}</span>
              <span>•</span>
              <span className="capitalize">{countryProfile.developmentLevel}</span>
              <span>•</span>
              <span className="capitalize">{countryProfile.politicalTradition}</span>
            </div>
          </div>
        </motion.div>

        {/* Keyboard Shortcuts Help */}
        <motion.div
          className="text-muted-foreground mt-4 text-center text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p>
            💡 <strong>Pro tip:</strong> Components with high compatibility scores for your country
            profile are highlighted. Use AI recommendations for optimal combinations.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
