"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Crown, Settings, Zap, ArrowRight, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { CountrySelectorEnhanced } from './CountrySelectorEnhanced';
import { EconomicCustomizationHub } from './EconomicCustomizationHub';
import { AtomicComponentSelector, ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { GovernmentBuilder } from '~/components/government/GovernmentBuilder';
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import type { RealCountryData, EconomicInputs } from '../../lib/economy-data-service';
import { parseEconomyData, createDefaultEconomicInputs } from '../../lib/economy-data-service';
import { TaxBuilder, type TaxBuilderState } from '~/components/tax-system/TaxBuilder';
import type { GovernmentBuilderState } from '~/types/government';

interface AtomicBuilderPageEnhancedProps {
  onBackToIntro?: () => void;
}

type BuilderStep = 'foundation' | 'government' | 'economics' | 'taxes' | 'preview';

interface BuilderState {
  step: BuilderStep;
  selectedCountry: RealCountryData | null;
  economicInputs: EconomicInputs | null;
  governmentComponents: ComponentType[];
  taxSystemData: any;
  governmentStructure: any;
  completedSteps: BuilderStep[];
}

const stepConfig = {
  foundation: {
    title: 'Foundation',
    description: 'Choose your country foundation',
    icon: Crown,
    color: 'from-amber-500 to-yellow-500',
  },
  government: {
    title: 'Government',
    description: 'Design government structure',
    icon: Settings,
    color: 'from-blue-500 to-indigo-500',
  },
  economics: {
    title: 'Economics',
    description: 'Configure economic system',
    icon: Zap,
    color: 'from-green-500 to-emerald-500',
  },
  taxes: {
    title: 'Tax System',
    description: 'Create tax policies',
    icon: Settings,
    color: 'from-purple-500 to-violet-500',
  },
  preview: {
    title: 'Preview',
    description: 'Review and finalize',
    icon: CheckCircle,
    color: 'from-green-500 to-teal-500',
  },
};

export function AtomicBuilderPageEnhanced({ onBackToIntro }: AtomicBuilderPageEnhancedProps) {
  const { user } = useUser();
  const router = useRouter();
  
  const [builderState, setBuilderState] = useState<BuilderState>({
    step: 'foundation',
    selectedCountry: null,
    economicInputs: null,
    governmentComponents: [],
    taxSystemData: null,
    governmentStructure: null,
    completedSteps: [],
  });

  const [countries, setCountries] = useState<RealCountryData[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [countryLoadError, setCountryLoadError] = useState<string | null>(null);

  // Load countries data on component mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        setIsLoadingCountries(true);
        setCountryLoadError(null);
        const countryData = await parseEconomyData();
        setCountries(countryData);
      } catch (error) {
        console.error('Failed to load countries:', error);
        setCountryLoadError(error instanceof Error ? error.message : 'Failed to load countries');
      } finally {
        setIsLoadingCountries(false);
      }
    };

    loadCountries();
  }, []);

  // Create country mutation
  const createCountryMutation = (api.countries as any)?.createCountry?.useMutation?.({
    onSuccess: (country: any) => {
      router.push(createUrl(`/mycountry`));
    },
  });

  const handleStepComplete = useCallback((step: BuilderStep, data?: any) => {
    setBuilderState(prev => {
      const newState = { ...prev };
      
      if (!prev.completedSteps.includes(step)) {
        newState.completedSteps = [...prev.completedSteps, step];
      }

      switch (step) {
        case 'foundation':
          newState.selectedCountry = data;
          newState.step = 'government';
          break;
        case 'government':
          newState.governmentComponents = data;
          newState.step = 'economics';
          if (prev.selectedCountry) {
            newState.economicInputs = createDefaultEconomicInputs(prev.selectedCountry);
          }
          break;
        case 'economics':
          newState.economicInputs = data;
          newState.step = 'taxes';
          break;
        case 'taxes':
          newState.taxSystemData = data;
          newState.step = 'preview';
          break;
      }
      
      return newState;
    });
  }, []);

  const handlePreviousStep = useCallback(() => {
    const steps: BuilderStep[] = ['foundation', 'government', 'economics', 'taxes', 'preview'];
    const currentIndex = steps.indexOf(builderState.step);
    if (currentIndex > 0) {
      setBuilderState(prev => ({ ...prev, step: steps[currentIndex - 1]! }));
    }
  }, [builderState.step]);

  const handleCreateCountry = useCallback(async () => {
    if (!builderState.selectedCountry || !user) return;

    try {
      await createCountryMutation.mutateAsync({
        name: builderState.selectedCountry.name,
        continent: builderState.selectedCountry.continent,
        region: builderState.selectedCountry.region,
        economicTier: builderState.selectedCountry.economicTier,
        governmentType: builderState.selectedCountry.governmentType,
        baselinePopulation: builderState.selectedCountry.baselinePopulation,
        baselineGdpPerCapita: builderState.selectedCountry.baselineGdpPerCapita,
        maxGdpGrowthRate: builderState.selectedCountry.maxGdpGrowthRate,
        flag: builderState.selectedCountry.flag,
      });
    } catch (error) {
      console.error('Failed to create country:', error);
    }
  }, [builderState, user, createCountryMutation]);

  const getStepProgress = () => {
    const steps: BuilderStep[] = ['foundation', 'government', 'economics', 'taxes', 'preview'];
    const currentIndex = steps.indexOf(builderState.step);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Atomic Nation Builder
              </h1>
              <Badge variant="outline" className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
                Enhanced with Atomic Components
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Step {Object.keys(stepConfig).indexOf(builderState.step) + 1} of 5
              </div>
              <div className="w-32">
                <Progress value={getStepProgress()} className="h-2" />
              </div>
              {onBackToIntro && (
                <Button variant="outline" onClick={onBackToIntro}>
                  Back to Intro
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Step Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {Object.entries(stepConfig).map(([step, config], index) => {
              const isCompleted = builderState.completedSteps.includes(step as BuilderStep);
              const isCurrent = builderState.step === step;
              const Icon = config.icon;
              
              return (
                <React.Fragment key={step}>
                  <div
                    className={`flex flex-col items-center space-y-2 cursor-pointer ${
                      isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                    }`}
                    onClick={() => setBuilderState(prev => ({ ...prev, step: step as BuilderStep }))}
                  >
                    <div className={`p-3 rounded-full border-2 ${
                      isCurrent 
                        ? 'border-primary bg-primary/10' 
                        : isCompleted 
                          ? 'border-green-600 bg-green-50' 
                          : 'border-muted-foreground/30 bg-muted/20'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium">{config.title}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                  </div>
                  {index < Object.keys(stepConfig).length - 1 && (
                    <ArrowRight className={`h-4 w-4 ${
                      builderState.completedSteps.includes(Object.keys(stepConfig)[index + 1] as BuilderStep)
                        ? 'text-green-600'
                        : 'text-muted-foreground/30'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        {builderState.step === 'foundation' ? (
          <div className="space-y-6">
            {isLoadingCountries ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Settings className="h-6 w-6 text-primary" />
                  </motion.div>
                  <span className="text-muted-foreground">Loading countries data...</span>
                </div>
              </div>
            ) : countryLoadError ? (
              <Alert className="border-red-200 bg-red-50/50">
                <AlertDescription>
                  <strong>Error loading countries:</strong> {countryLoadError}
                  <br />
                  Please refresh the page to try again.
                </AlertDescription>
              </Alert>
            ) : (
              <CountrySelectorEnhanced 
                countries={countries}
                onCountrySelect={(country) => {
                  handleStepComplete('foundation', country);
                }}
                onCardHoverChange={() => {}}
                onBackToIntro={onBackToIntro}
              />
            )}
          </div>
        ) : (
          <Card className="max-w-6xl mx-auto">
            <CardContent className="p-8">
            {builderState.step === 'government' && (
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-bold">Design Government Structure</h2>
                  <p className="text-muted-foreground">
                    Build your government using atomic components that create emergent complexity
                  </p>
                </div>

                <Alert className="border-indigo-200 bg-indigo-50/50">
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Atomic Government System:</strong> Select components that work together 
                    to create a sophisticated governmental structure with emergent properties.
                  </AlertDescription>
                </Alert>
                
                <Tabs defaultValue="components" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="components">Atomic Components</TabsTrigger>
                    <TabsTrigger value="structure">Structure Builder</TabsTrigger>
                  </TabsList>

                  <TabsContent value="components">
                    <AtomicComponentSelector
                      selectedComponents={builderState.governmentComponents}
                      onComponentChange={(components) => {
                        setBuilderState(prev => ({ 
                          ...prev, 
                          governmentComponents: components 
                        }));
                      }}
                      maxComponents={8}
                      isReadOnly={false}
                    />
                    
                    <div className="flex justify-center mt-6">
                      <Button
                        onClick={() => handleStepComplete('government', builderState.governmentComponents)}
                        disabled={builderState.governmentComponents.length === 0}
                        className="px-8"
                      >
                        Continue with {builderState.governmentComponents.length} Components
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="structure">
                    <GovernmentBuilder
                      onSave={async (structure: any) => {
                        setBuilderState(prev => ({ 
                          ...prev, 
                          governmentStructure: structure 
                        }));
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}

              {builderState.step === 'economics' && builderState.selectedCountry && builderState.economicInputs && (
                <div className="space-y-6">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-bold">Configure Economic System</h2>
                  <p className="text-muted-foreground">
                    Customize the economic parameters for {builderState.selectedCountry.name}
                  </p>
                </div>
                
                <EconomicCustomizationHub 
                  inputs={builderState.economicInputs} 
                  referenceCountry={builderState.selectedCountry}
                  onInputsChange={(economicInputs: EconomicInputs) => {
                    handleStepComplete('economics', economicInputs);
                  }}
                  onPreview={() => setBuilderState(prev => ({ ...prev, step: 'preview' }))}
                  onBack={handlePreviousStep}
                />
              </div>
            )}

            {builderState.step === 'taxes' && (
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-bold">Create Tax System</h2>
                  <p className="text-muted-foreground">
                    Design a comprehensive tax system for your nation
                  </p>
                </div>
                
                <TaxBuilder
                  countryId="" // Will be set after country creation
                  onSave={async (taxSystem: TaxBuilderState) => {
                    handleStepComplete('taxes', taxSystem);
                  }}
                />
              </div>
            )}

            {builderState.step === 'preview' && (
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-bold">Review Your Nation</h2>
                  <p className="text-muted-foreground">
                    Review your configuration and create your nation
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Foundation Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="h-5 w-5" />
                        Foundation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {builderState.selectedCountry && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name:</span>
                            <span className="font-medium">{builderState.selectedCountry.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Region:</span>
                            <span className="font-medium">{builderState.selectedCountry.region}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Economic Tier:</span>
                            <Badge variant="outline">{builderState.selectedCountry.economicTier}</Badge>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Government Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Government
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Components:</span>
                        <Badge variant="outline">{builderState.governmentComponents.length} Selected</Badge>
                      </div>
                      <div className="space-y-1">
                        {builderState.governmentComponents.slice(0, 3).map((component) => (
                          <div key={component} className="text-xs text-muted-foreground">
                            • {component.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                        ))}
                        {builderState.governmentComponents.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            ... and {builderState.governmentComponents.length - 3} more
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-center space-x-4 pt-6">
                  <Button variant="outline" onClick={handlePreviousStep}>
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateCountry}
                    disabled={createCountryMutation.isLoading}
                    className="px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  >
                    {createCountryMutation.isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="h-4 w-4 mr-2"
                        >
                          <Settings className="h-4 w-4" />
                        </motion.div>
                        Creating Nation...
                      </>
                    ) : (
                      <>
                        Create My Nation
                        <Crown className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}