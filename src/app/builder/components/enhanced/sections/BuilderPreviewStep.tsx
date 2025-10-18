"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import {
  Flag,
  Globe,
  Users,
  DollarSign,
  Building2,
  TrendingUp,
  BarChart3,
  Scale,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  Crown,
  Landmark,
  Target,
  MapPin,
  Calendar,
  Phone,
  Languages,
  Music,
  Heart,
  GraduationCap,
  Factory,
  Wrench,
  Home,
  Car,
  UtensilsCrossed
} from 'lucide-react';
import { useBuilderContext } from '../context/BuilderStateContext';
import { formatCurrency } from '~/lib/format-utils';
import { cn } from '~/lib/utils';
import { UnifiedCountryFlag } from '~/components/UnifiedCountryFlag';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';

// Import government preview components
import { StructureOverview } from '../government-preview/StructureOverview';
import { ComponentsList } from '../government-preview/ComponentsList';
import { DepartmentsList } from '../government-preview/DepartmentsList';
import { BudgetAllocationList } from '../government-preview/BudgetAllocationList';
import { RevenueSourcesList } from '../government-preview/RevenueSourcesList';

interface SectionState {
  nationalIdentity: boolean;
  coreIndicators: boolean;
  governmentConfig: boolean;
  economyConfig: boolean;
  taxSystem: boolean;
}

/**
 * BuilderPreviewStep - Comprehensive preview of all builder configuration data
 * 
 * Displays a complete overview of the country being built with collapsible sections
 * for National Identity, Core Indicators, Government Configuration, Economy Configuration,
 * and Tax System. All data is live-wired from the builder state context.
 */
export function BuilderPreviewStep() {
  const { builderState } = useBuilderContext();
  
  // Collapsible state for main sections
  const [sectionStates, setSectionStates] = useState<SectionState>({
    nationalIdentity: true,
    coreIndicators: true,
    governmentConfig: false,
    economyConfig: false,
    taxSystem: false,
  });

  // Individual item collapsible states (for government structure)
  const [openDepartments, setOpenDepartments] = useState<Record<string, boolean>>({});
  const [openAllocations, setOpenAllocations] = useState<Record<string, boolean>>({});
  const [openRevenues, setOpenRevenues] = useState<Record<string, boolean>>({});

  // Helper functions
  const toggleSection = (section: keyof SectionState) => {
    setSectionStates(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const expandAll = () => {
    setSectionStates({
      nationalIdentity: true,
      coreIndicators: true,
      governmentConfig: true,
      economyConfig: true,
      taxSystem: true,
    });
  };

  const collapseAll = () => {
    setSectionStates({
      nationalIdentity: false,
      coreIndicators: false,
      governmentConfig: false,
      economyConfig: false,
      taxSystem: false,
    });
  };

  const allExpanded = Object.values(sectionStates).every(Boolean);

  // Data validation and fallbacks
  const economicInputs = builderState.economicInputs;
  const nationalIdentity = economicInputs?.nationalIdentity;
  const coreIndicators = economicInputs?.coreIndicators;
  const laborEmployment = economicInputs?.laborEmployment;
  const demographics = economicInputs?.demographics;
  const governmentComponents = builderState.governmentComponents || [];
  const governmentStructure = builderState.governmentStructure;
  const taxSystemData = builderState.taxSystemData;

  // Format currency helper
  const formatCurrencyLocal = (amount: number) => 
    formatCurrency(amount, coreIndicators?.currencyExchangeRate ? 'USD' : 'USD');

  // Get government type icon
  const getGovernmentTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'democracy': return <Users className="h-5 w-5" />;
      case 'republic': return <Landmark className="h-5 w-5" />;
      case 'monarchy': return <Crown className="h-5 w-5" />;
      case 'federation': return <Building2 className="h-5 w-5" />;
      default: return <Building2 className="h-5 w-5" />;
    }
  };

  // Get department icon
  const getDepartmentIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'executive': return <Crown className="h-4 w-4" />;
      case 'legislative': return <Landmark className="h-4 w-4" />;
      case 'judicial': return <Scale className="h-4 w-4" />;
      case 'defense': return <Target className="h-4 w-4" />;
      case 'finance': return <DollarSign className="h-4 w-4" />;
      case 'health': return <Users className="h-4 w-4" />;
      case 'education': return <Briefcase className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };

  // Normalize government structure for preview components
  const normalizedGovernmentStructure = useMemo(() => {
    if (!governmentStructure) return null;
    
    // If it's already a GovernmentStructure, return as is
    if ('id' in governmentStructure && 'countryId' in governmentStructure) {
      return governmentStructure;
    }
    
    // If it's a GovernmentBuilderState, convert it
    const builderState = governmentStructure as any;
    return {
      id: 'preview',
      countryId: 'preview',
      governmentName: builderState.structure?.governmentName || 'Government',
      governmentType: builderState.structure?.governmentType || 'Democracy',
      headOfState: builderState.structure?.headOfState,
      headOfGovernment: builderState.structure?.headOfGovernment,
      legislatureName: builderState.structure?.legislatureName,
      executiveName: builderState.structure?.executiveName,
      judicialName: builderState.structure?.judicialName,
      totalBudget: builderState.structure?.totalBudget || 0,
      fiscalYear: builderState.structure?.fiscalYear || new Date().getFullYear().toString(),
      budgetCurrency: builderState.structure?.budgetCurrency || 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
      departments: (builderState.departments || []).map((dept: any, index: number) => ({
        id: index.toString(),
        governmentStructureId: 'preview',
        name: dept.name,
        shortName: dept.shortName,
        category: dept.category,
        description: dept.description,
        minister: dept.minister,
        ministerTitle: dept.ministerTitle,
        headquarters: dept.headquarters,
        established: dept.established,
        employeeCount: dept.employeeCount,
        icon: dept.icon,
        color: dept.color,
        priority: dept.priority,
        isActive: true,
        parentDepartmentId: dept.parentDepartmentId,
        organizationalLevel: dept.organizationalLevel,
        functions: dept.functions,
        kpis: dept.kpis || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentDepartment: undefined,
        subDepartments: [],
        budgetAllocations: [],
        subBudgets: []
      })),
      budgetAllocations: (builderState.budgetAllocations || []).map((alloc: any, index: number) => ({
        id: index.toString(),
        governmentStructureId: 'preview',
        departmentId: alloc.departmentId,
        allocatedAmount: alloc.allocatedAmount,
        spentAmount: 0,
        encumberedAmount: 0,
        availableAmount: alloc.allocatedAmount,
        budgetStatus: 'In Use' as const,
        budgetYear: alloc.budgetYear,
        allocatedPercent: alloc.allocatedPercent,
        lastReviewed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        department: undefined as any
      })),
      revenueSources: (builderState.revenueSources || []).map((source: any, index: number) => ({
        id: index.toString(),
        governmentStructureId: 'preview',
        name: source.name,
        category: source.category,
        description: source.description,
        revenueAmount: source.revenueAmount,
        revenuePercent: source.revenuePercent || 0,
        isActive: true,
        rate: source.rate,
        collectionMethod: source.collectionMethod,
        administeredBy: source.administeredBy,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    };
  }, [governmentStructure]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg mb-4">
          <Flag className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold">Review Your Nation</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Review all your configurations before creating your nation
        </p>
      </motion.div>

      {/* Master Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <Eye className="h-3 w-3 mr-1" />
            Preview Mode
          </Badge>
          <span className="text-sm text-muted-foreground">
            {Object.values(sectionStates).filter(Boolean).length} of {Object.keys(sectionStates).length} sections expanded
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={allExpanded ? collapseAll : expandAll}
            className="gap-2"
          >
            {allExpanded ? (
              <>
                <ChevronsDownUp className="h-4 w-4" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-4 w-4" />
                Expand All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 1. National Identity Section */}
      <Collapsible open={sectionStates.nationalIdentity} onOpenChange={() => toggleSection('nationalIdentity')}>
        <Card className="border-amber-200/50 bg-amber-50/30 backdrop-blur-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-amber-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Flag className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">National Identity</CardTitle>
                    <p className="text-sm text-muted-foreground">Country symbols and identity</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-100 text-amber-700">
                    {nationalIdentity ? 'Configured' : 'Not Set'}
                  </Badge>
                  {sectionStates.nationalIdentity ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {nationalIdentity ? (
                <div className="space-y-6">
                  {/* Flag and Coat of Arms */}
                  <div className="flex items-center justify-center gap-8">
                    {/* Flag */}
                    <div className="text-center">
                      {economicInputs?.flagUrl ? (
                        <div className="group cursor-pointer">
                          <Dialog>
                            <DialogTrigger asChild>
                              <div className="relative p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-lg border border-blue-400/30 group-hover:border-blue-400/50 transition-all duration-300 backdrop-blur-sm">
                                <UnifiedCountryFlag 
                                  countryName={nationalIdentity.countryName}
                                  size="lg"
                                  className="w-24 h-16 rounded object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>National Flag - {nationalIdentity.countryName}</DialogTitle>
                              </DialogHeader>
                              <div className="flex justify-center p-4">
                                <UnifiedCountryFlag 
                                  countryName={nationalIdentity.countryName}
                                  size="xl"
                                  className="max-w-full max-h-96 object-contain rounded-lg"
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : (
                        <div className="w-24 h-16 bg-gray-100 rounded flex items-center justify-center border">
                          <Flag className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div className="text-xs font-medium text-blue-400 mt-2">National Flag</div>
                    </div>

                    {/* Coat of Arms */}
                    <div className="text-center">
                      {economicInputs?.coatOfArmsUrl ? (
                        <div className="group cursor-pointer">
                          <Dialog>
                            <DialogTrigger asChild>
                              <div className="relative p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-400/30 group-hover:border-amber-400/50 transition-all duration-300 backdrop-blur-sm">
                                <img
                                  src={economicInputs.coatOfArmsUrl}
                                  alt="Coat of Arms"
                                  className="w-16 h-16 rounded object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Coat of Arms - {nationalIdentity.countryName}</DialogTitle>
                              </DialogHeader>
                              <div className="flex justify-center p-4">
                                <img
                                  src={economicInputs.coatOfArmsUrl}
                                  alt="Coat of Arms"
                                  className="max-w-full max-h-96 object-contain rounded-lg"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center border">
                          <Crown className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div className="text-xs font-medium text-amber-400 mt-2">Coat of Arms</div>
                    </div>
                  </div>

                  {/* Identity Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-amber-700 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Basic Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Country:</span> {nationalIdentity.countryName}
                        </div>
                        {nationalIdentity.officialName && (
                          <div>
                            <span className="font-medium">Official:</span> {nationalIdentity.officialName}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Capital:</span> {nationalIdentity.capitalCity}
                        </div>
                        {nationalIdentity.largestCity && (
                          <div>
                            <span className="font-medium">Largest City:</span> {nationalIdentity.largestCity}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-amber-700 flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Government & Culture
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Government:</span> {nationalIdentity.governmentType}
                        </div>
                        <div>
                          <span className="font-medium">Demonym:</span> {nationalIdentity.demonym}
                        </div>
                        <div>
                          <span className="font-medium">Currency:</span> {nationalIdentity.currency}
                        </div>
                        {nationalIdentity.nationalReligion && (
                          <div>
                            <span className="font-medium">Religion:</span> {nationalIdentity.nationalReligion}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-amber-700 flex items-center gap-2">
                        <Languages className="h-4 w-4" />
                        Language & Symbols
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Language:</span> {nationalIdentity.officialLanguages}
                        </div>
                        <div>
                          <span className="font-medium">Native:</span> {nationalIdentity.nationalLanguage}
                        </div>
                        {nationalIdentity.motto && (
                          <div>
                            <span className="font-medium">Motto:</span> {nationalIdentity.motto}
                          </div>
                        )}
                        {nationalIdentity.nationalAnthem && (
                          <div>
                            <span className="font-medium">Anthem:</span> {nationalIdentity.nationalAnthem}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional Details */}
                  {(nationalIdentity.nationalDay || nationalIdentity.callingCode) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          <span className="font-medium">National Day:</span> {nationalIdentity.nationalDay || 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          <span className="font-medium">Calling Code:</span> {nationalIdentity.callingCode || 'Not set'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">No national identity configured</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 2. Core Economic Indicators Section */}
      <Collapsible open={sectionStates.coreIndicators} onOpenChange={() => toggleSection('coreIndicators')}>
        <Card className="border-blue-200/50 bg-blue-50/30 backdrop-blur-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-blue-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Core Economic Indicators</CardTitle>
                    <p className="text-sm text-muted-foreground">Primary economic metrics</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700">
                    {coreIndicators ? 'Configured' : 'Not Set'}
                  </Badge>
                  {sectionStates.coreIndicators ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {coreIndicators ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-white/50 rounded-lg border">
                    <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">
                      {coreIndicators.totalPopulation?.toLocaleString() || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Population</div>
                  </div>

                  <div className="text-center p-4 bg-white/50 rounded-lg border">
                    <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">
                      {coreIndicators.nominalGDP ? formatCurrencyLocal(coreIndicators.nominalGDP) : 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Nominal GDP</div>
                  </div>

                  <div className="text-center p-4 bg-white/50 rounded-lg border">
                    <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600">
                      {coreIndicators.gdpPerCapita ? formatCurrencyLocal(coreIndicators.gdpPerCapita) : 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">GDP per Capita</div>
                  </div>

                  <div className="text-center p-4 bg-white/50 rounded-lg border">
                    <BarChart3 className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-orange-600">
                      {coreIndicators.realGDPGrowthRate ? `${coreIndicators.realGDPGrowthRate}%` : 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">GDP Growth Rate</div>
                  </div>

                  <div className="text-center p-4 bg-white/50 rounded-lg border">
                    <TrendingUp className="h-8 w-8 text-red-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-red-600">
                      {coreIndicators.inflationRate ? `${coreIndicators.inflationRate}%` : 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Inflation Rate</div>
                  </div>

                  <div className="text-center p-4 bg-white/50 rounded-lg border">
                    <Globe className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-indigo-600">
                      {coreIndicators.currencyExchangeRate || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Exchange Rate</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">No economic indicators configured</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 3. Government Configuration Section */}
      <Collapsible open={sectionStates.governmentConfig} onOpenChange={() => toggleSection('governmentConfig')}>
        <Card className="border-indigo-200/50 bg-indigo-50/30 backdrop-blur-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-indigo-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Government Configuration</CardTitle>
                    <p className="text-sm text-muted-foreground">Government structure and components</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-indigo-100 text-indigo-700">
                    {governmentComponents.length} Components
                  </Badge>
                  {sectionStates.governmentConfig ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-6">
                {/* Government Structure Overview */}
                {normalizedGovernmentStructure && (
                  <StructureOverview
                    structure={normalizedGovernmentStructure}
                    getGovernmentTypeIcon={getGovernmentTypeIcon}
                  />
                )}

                {/* Atomic Components */}
                {governmentComponents.length > 0 && (
                  <ComponentsList
                    components={governmentComponents}
                    isOpen={true}
                    onOpenChange={() => {}}
                  />
                )}

                {/* Departments and Budget */}
                {normalizedGovernmentStructure && (
                  <>
                    <DepartmentsList
                      departments={normalizedGovernmentStructure.departments}
                      budgetAllocations={normalizedGovernmentStructure.budgetAllocations}
                      totalBudget={normalizedGovernmentStructure.totalBudget}
                      currency={normalizedGovernmentStructure.budgetCurrency}
                      isOpen={true}
                      onOpenChange={() => {}}
                      openDepartments={openDepartments}
                      onToggleDepartment={(id) => setOpenDepartments(prev => ({ ...prev, [id]: !prev[id] }))}
                      getDepartmentIcon={getDepartmentIcon}
                    />

                    <BudgetAllocationList
                      allocations={normalizedGovernmentStructure.budgetAllocations}
                      departments={normalizedGovernmentStructure.departments}
                      totalBudget={normalizedGovernmentStructure.totalBudget}
                      currency={normalizedGovernmentStructure.budgetCurrency}
                      isOpen={true}
                      onOpenChange={() => {}}
                      openAllocations={openAllocations}
                      onToggleAllocation={(id) => setOpenAllocations(prev => ({ ...prev, [id]: !prev[id] }))}
                    />

                    <RevenueSourcesList
                      sources={normalizedGovernmentStructure.revenueSources}
                      totalRevenue={normalizedGovernmentStructure.revenueSources.reduce((sum: number, r: any) => sum + r.revenueAmount, 0)}
                      currency={normalizedGovernmentStructure.budgetCurrency}
                      isOpen={true}
                      onOpenChange={() => {}}
                      openRevenues={openRevenues}
                      onToggleRevenue={(id) => setOpenRevenues(prev => ({ ...prev, [id]: !prev[id] }))}
                    />
                  </>
                )}

                {governmentComponents.length === 0 && !normalizedGovernmentStructure && (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">No government configuration set</p>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 4. Economy Configuration Section */}
      <Collapsible open={sectionStates.economyConfig} onOpenChange={() => toggleSection('economyConfig')}>
        <Card className="border-green-200/50 bg-green-50/30 backdrop-blur-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-green-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Factory className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Economy Configuration</CardTitle>
                    <p className="text-sm text-muted-foreground">Labor, demographics, and economic sectors</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-700">
                    {laborEmployment || demographics ? 'Configured' : 'Not Set'}
                  </Badge>
                  {sectionStates.economyConfig ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-6">
                {/* Labor & Employment */}
                {laborEmployment && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-green-700 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Labor & Employment
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-3 bg-white/50 rounded-lg border">
                        <div className="text-lg font-bold text-green-600">
                          {laborEmployment.laborForceParticipationRate}%
                        </div>
                        <div className="text-sm text-muted-foreground">Labor Force Participation</div>
                      </div>
                      <div className="p-3 bg-white/50 rounded-lg border">
                        <div className="text-lg font-bold text-green-600">
                          {laborEmployment.employmentRate}%
                        </div>
                        <div className="text-sm text-muted-foreground">Employment Rate</div>
                      </div>
                      <div className="p-3 bg-white/50 rounded-lg border">
                        <div className="text-lg font-bold text-red-600">
                          {laborEmployment.unemploymentRate}%
                        </div>
                        <div className="text-sm text-muted-foreground">Unemployment Rate</div>
                      </div>
                      <div className="p-3 bg-white/50 rounded-lg border">
                        <div className="text-lg font-bold text-blue-600">
                          {laborEmployment.totalWorkforce?.toLocaleString() || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Workforce</div>
                      </div>
                      <div className="p-3 bg-white/50 rounded-lg border">
                        <div className="text-lg font-bold text-purple-600">
                          {laborEmployment.averageWorkweekHours}hrs
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Work Week</div>
                      </div>
                      <div className="p-3 bg-white/50 rounded-lg border">
                        <div className="text-lg font-bold text-orange-600">
                          {laborEmployment.averageAnnualIncome ? formatCurrencyLocal(laborEmployment.averageAnnualIncome) : 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Annual Income</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Demographics */}
                {demographics && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-green-700 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Demographics
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {demographics.ageDistribution && demographics.ageDistribution.length > 0 && (
                        <>
                          <div className="p-3 bg-white/50 rounded-lg border">
                            <div className="text-lg font-bold text-blue-600">
                              {demographics.ageDistribution[0]?.percent || 0}%
                            </div>
                            <div className="text-sm text-muted-foreground">Youth Population</div>
                          </div>
                          <div className="p-3 bg-white/50 rounded-lg border">
                            <div className="text-lg font-bold text-green-600">
                              {demographics.ageDistribution[1]?.percent || 0}%
                            </div>
                            <div className="text-sm text-muted-foreground">Working Age</div>
                          </div>
                          <div className="p-3 bg-white/50 rounded-lg border">
                            <div className="text-lg font-bold text-purple-600">
                              {demographics.ageDistribution[2]?.percent || 0}%
                            </div>
                            <div className="text-sm text-muted-foreground">Elderly Population</div>
                          </div>
                        </>
                      )}
                      {demographics.urbanRuralSplit && (
                        <div className="p-3 bg-white/50 rounded-lg border">
                          <div className="text-lg font-bold text-orange-600">
                            {demographics.urbanRuralSplit.urban}%
                          </div>
                          <div className="text-sm text-muted-foreground">Urban Population</div>
                        </div>
                      )}
                      <div className="p-3 bg-white/50 rounded-lg border">
                        <div className="text-lg font-bold text-red-600">
                          {demographics.lifeExpectancy || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Life Expectancy</div>
                      </div>
                      <div className="p-3 bg-white/50 rounded-lg border">
                        <div className="text-lg font-bold text-indigo-600">
                          {demographics.populationGrowthRate || 'N/A'}%
                        </div>
                        <div className="text-sm text-muted-foreground">Population Growth</div>
                      </div>
                    </div>
                  </div>
                )}

                {!laborEmployment && !demographics && (
                  <div className="text-center py-8">
                    <Factory className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">No economy configuration set</p>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 5. Tax System Section */}
      <Collapsible open={sectionStates.taxSystem} onOpenChange={() => toggleSection('taxSystem')}>
        <Card className="border-red-200/50 bg-red-50/30 backdrop-blur-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-red-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Scale className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Tax System</CardTitle>
                    <p className="text-sm text-muted-foreground">Tax categories, brackets, and revenue</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-100 text-red-700">
                    {taxSystemData?.categories?.length || 0} Categories
                  </Badge>
                  {sectionStates.taxSystem ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {taxSystemData ? (
                <div className="space-y-6">
                  {/* Tax System Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white/50 rounded-lg border">
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {taxSystemData.taxSystem?.taxSystemName || 'Unnamed System'}
                      </div>
                      <div className="text-sm text-muted-foreground">Tax System Name</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {taxSystemData.taxSystem?.fiscalYear || 'N/A'}
                      </div>
                      <div className="text-sm text-muted-foreground">Fiscal Year</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {taxSystemData.taxSystem?.progressiveTax ? 'Progressive' : 'Flat'}
                      </div>
                      <div className="text-sm text-muted-foreground">Tax Type</div>
                    </div>
                  </div>

                  {/* Tax Categories */}
                  {taxSystemData.categories && taxSystemData.categories.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-red-700 flex items-center gap-2">
                        <Scale className="h-4 w-4" />
                        Tax Categories
                      </h4>
                      <div className="space-y-3">
                        {taxSystemData.categories.map((category, index) => (
                          <Collapsible key={index} open={openDepartments[`tax-${index}`]} onOpenChange={(open) => setOpenDepartments(prev => ({ ...prev, [`tax-${index}`]: open }))}>
                            <Card className="border">
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                                  <div>
                                    <div className="font-medium flex items-center gap-2">
                                      {category.categoryName}
                                      {openDepartments[`tax-${index}`] ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {category.categoryType} • {category.calculationMethod}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline">
                                      {category.baseRate}% base rate
                                    </Badge>
                                    {taxSystemData.brackets && taxSystemData.brackets[index.toString()]?.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {taxSystemData.brackets[index.toString()].length} brackets
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 border-t bg-muted/20">
                                  <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                                  
                                  {/* Tax Brackets */}
                                  {taxSystemData.brackets && taxSystemData.brackets[index.toString()] && (
                                    <div className="space-y-2">
                                      <h5 className="font-medium text-sm">Tax Brackets:</h5>
                                      <div className="space-y-1">
                                        {taxSystemData.brackets[index.toString()].map((bracket, bracketIndex) => (
                                          <div key={bracketIndex} className="text-xs bg-white/50 p-2 rounded border">
                                            {bracket.minIncome && bracket.maxIncome ? (
                                              `${formatCurrencyLocal(bracket.minIncome)} - ${formatCurrencyLocal(bracket.maxIncome)}: ${bracket.rate}%`
                                            ) : bracket.minIncome ? (
                                              `${formatCurrencyLocal(bracket.minIncome)}+: ${bracket.rate}%`
                                            ) : (
                                              `${bracket.rate}%`
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exemptions and Deductions */}
                  {(taxSystemData.exemptions?.length > 0 || Object.keys(taxSystemData.deductions || {}).length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {taxSystemData.exemptions && taxSystemData.exemptions.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Exemptions:</h5>
                          <div className="space-y-1">
                            {taxSystemData.exemptions.map((exemption, index) => (
                              <div key={index} className="text-xs bg-white/50 p-2 rounded border">
                                <div className="font-medium">{exemption.exemptionName}</div>
                                <div className="text-muted-foreground">{exemption.description}</div>
                                <div className="text-green-600">{formatCurrencyLocal(exemption.exemptionAmount ?? 0)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.keys(taxSystemData.deductions || {}).length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Deductions:</h5>
                          <div className="space-y-1">
                            {Object.entries(taxSystemData.deductions || {}).flatMap(([categoryIndex, deductions]) =>
                              deductions.map((deduction, index) => (
                                <div key={`${categoryIndex}-${index}`} className="text-xs bg-white/50 p-2 rounded border">
                                  <div className="font-medium">{deduction.deductionName}</div>
                                  <div className="text-muted-foreground">{deduction.description}</div>
                                  <div className="text-blue-600">{formatCurrencyLocal(deduction.maximumAmount ?? 0)}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Scale className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">No tax system configured</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Summary Statistics */}
      <Card className="border-gray-200/50 bg-gray-50/30 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Configuration Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {nationalIdentity ? '✓' : '✗'}
              </div>
              <div className="text-sm text-muted-foreground">National Identity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {coreIndicators ? '✓' : '✗'}
              </div>
              <div className="text-sm text-muted-foreground">Core Indicators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {governmentComponents.length + (normalizedGovernmentStructure ? 1 : 0)}
              </div>
              <div className="text-sm text-muted-foreground">Government Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {(laborEmployment ? 1 : 0) + (demographics ? 1 : 0)}
              </div>
              <div className="text-sm text-muted-foreground">Economy Sections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {taxSystemData?.categories?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Tax Categories</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
