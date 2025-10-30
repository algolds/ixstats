"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ComponentType } from '@prisma/client';
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
  Crown
} from 'lucide-react';
import { cn } from '~/lib/utils';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../glass/GlassCard';

// Import atomic components
import { AtomicComponentSelector } from '~/components/government/atoms/AtomicGovernmentComponents';
import { AtomicImpactPreview } from '~/components/atomic/AtomicImpactPreview';
import { SmartRecommendations } from '~/components/atomic/SmartRecommendations';

// Import state management
import { 
  AtomicBuilderStateManager,
  type AtomicBuilderState,
  type BuilderMode 
} from '~/lib/atomic-builder-state';
import type { CountryProfile } from '~/lib/atomic-recommendations';

// Import existing builder components for hybrid mode
import type { EconomicInputs, RealCountryData } from '../../lib/economy-data-service';

interface AtomicBuilderPageNativeProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
  initialComponents?: ComponentType[];
}

const BUILDER_MODES: Record<BuilderMode, { name: string; description: string; icon: React.ReactNode }> = {
  atomic: {
    name: 'Atomic First',
    description: 'Build using atomic components as the primary approach',
    icon: <Settings className="w-4 h-4" />
  },
  traditional: {
    name: 'Traditional',
    description: 'Classic government structure builder',
    icon: <Users className="w-4 h-4" />
  },
  hybrid: {
    name: 'Hybrid',
    description: 'Combine atomic components with traditional structure',
    icon: <BarChart3 className="w-4 h-4" />
  }
};

export function AtomicBuilderPageNative({
  inputs,
  referenceCountry,
  onInputsChange,
  onPreview,
  onBack,
  initialComponents = []
}: AtomicBuilderPageNativeProps) {
  // State management
  const [stateManager] = useState(() => new AtomicBuilderStateManager({
    selectedComponents: initialComponents,
    builderMode: 'atomic'
  }));
  
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
    let size: 'small' | 'medium' | 'large' = 'medium';
    if (population < 10000000) size = 'small';
    else if (population > 100000000) size = 'large';
    
    // Determine development level based on GDP per capita
    const gdpPerCapita = gdp / population;
    let developmentLevel: 'developing' | 'emerging' | 'developed' = 'emerging';
    if (gdpPerCapita < 5000) developmentLevel = 'developing';
    else if (gdpPerCapita > 25000) developmentLevel = 'developed';
    
    // Infer political tradition (simplified logic)
    let politicalTradition: 'democratic' | 'authoritarian' | 'mixed' | 'traditional' = 'mixed';
    if (referenceCountry.governmentType?.toLowerCase().includes('democracy')) {
      politicalTradition = 'democratic';
    }
    
    // Generate challenges based on country data
    const challenges: Array<{
      type: 'economic_growth' | 'political_stability' | 'corruption' | 'inequality' | 'development';
      severity: 'low' | 'medium' | 'high';
    }> = [];
    
    if (gdpPerCapita < 10000) {
      challenges.push({ type: 'economic_growth', severity: 'high' });
    }
    if (developmentLevel === 'developing') {
      challenges.push({ type: 'development', severity: 'high' });
    }
    if (inputs.coreIndicators.giniCoefficient && inputs.coreIndicators.giniCoefficient > 40) {
      challenges.push({ type: 'inequality', severity: 'medium' });
    }

    return {
      size,
      developmentLevel,
      politicalTradition,
      economicSystem: 'mixed' as const,
      culturalContext: 'mixed' as const,
      primaryChallenges: challenges,
      gdp,
      population
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
    builderMode 
  } = builderState;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Back to builder"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center space-x-2">
                  <div className="p-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg">
                    <Crown className="w-6 h-6 text-purple-600" />
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
                  "flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                  isRealTimeUpdates 
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                )}
              >
                {isRealTimeUpdates ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                <span>Real-time</span>
              </button>
              
              {/* Reset button */}
              <button
                onClick={handleReset}
                className="flex items-center space-x-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-sm transition-colors"
                disabled={selectedComponents.length === 0}
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>

              {/* Preview button */}
              <button
                onClick={onPreview}
                className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <span>Preview Country</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Builder Mode Selection */}
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-sm font-medium text-muted-foreground">Builder Mode:</span>
            <div className="flex space-x-1">
              {Object.entries(BUILDER_MODES).map(([mode, config]) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode as BuilderMode)}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                    builderMode === mode
                      ? "bg-primary/10 text-primary border border-primary/20"
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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Component Selection - Left Panel */}
          <div className="xl:col-span-5">
            <GlassCard depth="elevated" blur="medium" motionPreset="slide">
              <GlassCardHeader>
                <div className="flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Component Selection</h2>
                  <span className="text-xs text-muted-foreground">
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
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  <h2 className="font-semibold">Live Impact Analysis</h2>
                  <div className="ml-auto text-right">
                    <div className="text-lg font-bold text-primary">
                      {effectivenessScore.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Effectiveness</div>
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
                  <Lightbulb className="w-5 h-5 text-purple-600" />
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
          className="mt-6 p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/20 rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>
                  <span className="font-medium">{synergies.length}</span> Active Synergies
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>
                  <span className="font-medium">{conflicts.length}</span> Conflicts
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>
                  <span className="font-medium">
                    {((economicImpact.gdpImpact.current - 1) * 100).toFixed(1)}%
                  </span> GDP Impact
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>
                  <span className="font-medium">{economicImpact.stabilityIndex.current.toFixed(0)}</span> Stability
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
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
          className="mt-4 text-center text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p>
            💡 <strong>Pro tip:</strong> Components with high compatibility scores for your country profile 
            are highlighted. Use AI recommendations for optimal combinations.
          </p>
        </motion.div>
      </div>
    </div>
  );
}