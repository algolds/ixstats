// src/components/quickactions/PolicyCreator.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { api } from '~/trpc/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Slider } from '~/components/ui/slider';
import { Progress } from '~/components/ui/progress';
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import {
  FileText,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  Library,
  Clock,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '~/lib/utils';
import { PolicyTemplateSelector } from './PolicyTemplateSelector';
import type { PolicyTemplate } from '~/lib/policy-taxonomy';

interface PolicyCreatorProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const POLICY_TYPES = [
  { value: 'economic', label: 'Economic Policy', icon: DollarSign, color: 'text-blue-600' },
  { value: 'social', label: 'Social Policy', icon: Users, color: 'text-green-600' },
  { value: 'infrastructure', label: 'Infrastructure', icon: Target, color: 'text-orange-600' },
  { value: 'governance', label: 'Governance', icon: FileText, color: 'text-purple-600' },
];

const PRIORITY_LEVELS = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
];

export function PolicyCreator({
  countryId,
  open,
  onOpenChange,
  onSuccess,
}: PolicyCreatorProps) {
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState('overview');
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [futureOpportunitiesExpanded, setFutureOpportunitiesExpanded] = useState(false);

  // Policy basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [policyType, setPolicyType] = useState<'economic' | 'social' | 'diplomatic' | 'infrastructure' | 'governance'>('economic');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');

  // Economic effects
  const [gdpEffect, setGdpEffect] = useState(0);
  const [employmentEffect, setEmploymentEffect] = useState(0);
  const [inflationEffect, setInflationEffect] = useState(0);
  const [taxRevenueEffect, setTaxRevenueEffect] = useState(0);

  // Costs
  const [implementationCost, setImplementationCost] = useState(0);
  const [maintenanceCost, setMaintenanceCost] = useState(0);

  // Get country data for recommendations
  const { data: country } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    { enabled: open && !!countryId }
  );

  // Get policy recommendations
  const { data: recommendations, isLoading: recommendationsLoading } = api.quickActions.getPolicyRecommendations.useQuery(
    { countryId, limit: 10 },
    { enabled: open && !!countryId }
  );

  // Get existing policies for history
  const { data: policies } = api.quickActions.getPolicies.useQuery(
    { countryId },
    { enabled: open && !!countryId }
  );

  // Create policy mutation
  const createPolicy = api.quickActions.createPolicy.useMutation({
    onSuccess: (result) => {
      toast.success('Policy created successfully!');
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to create policy: ${error.message}`);
    },
  });

  // Auto-calculate GDP based on other economic effects
  React.useEffect(() => {
    // GDP is influenced by employment, inflation, and tax policy
    // This is a simplified but realistic model
    const employmentImpact = employmentEffect * -0.4; // Negative unemployment = positive GDP
    const inflationImpact = inflationEffect * -0.2; // High inflation slightly negative for GDP
    const taxImpact = taxRevenueEffect * 0.3; // Tax revenue correlates with economic activity

    const calculatedGDP = employmentImpact + inflationImpact + taxImpact;
    setGdpEffect(parseFloat(calculatedGDP.toFixed(2)));
  }, [employmentEffect, inflationEffect, taxRevenueEffect]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPolicyType('economic');
    setCategory('');
    setPriority('medium');
    setGdpEffect(0);
    setEmploymentEffect(0);
    setInflationEffect(0);
    setTaxRevenueEffect(0);
    setImplementationCost(0);
    setMaintenanceCost(0);
  };

  const loadTemplate = (template: PolicyTemplate) => {
    setName(template.name);
    setDescription(template.description);
    setPolicyType(template.policyType);
    setCategory(template.category);
    setPriority(template.priority);
    setGdpEffect(template.gdpEffect ?? 0);
    setEmploymentEffect(template.employmentEffect ?? 0);
    setInflationEffect(template.inflationEffect ?? 0);
    setTaxRevenueEffect(template.taxRevenueEffect ?? 0);
    setImplementationCost(template.implementationCost ?? 0);
    setMaintenanceCost(template.maintenanceCost ?? 0);
    setTemplateSelectorOpen(false);
    setActiveTab('create');
    toast.success('Template loaded - adjust as needed');
  };

  const loadRecommendation = (rec: any) => {
    setName(rec.name);
    setDescription(rec.description);
    setPolicyType(rec.policyType);
    setCategory(rec.category);
    setPriority(rec.priority);
    setGdpEffect(rec.estimatedEffects.gdpEffect);
    setEmploymentEffect(rec.estimatedEffects.employmentEffect);
    setInflationEffect(rec.estimatedEffects.inflationEffect);
    setTaxRevenueEffect(rec.estimatedEffects.taxRevenueEffect);
    setImplementationCost(rec.implementationCost);
    setMaintenanceCost(rec.maintenanceCost);
    setActiveTab('create');
    toast.success('Recommendation loaded - adjust as needed');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !description.trim() || !category.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    createPolicy.mutate({
      countryId,
      userId: user?.id ?? '',
      policy: {
        name,
        description,
        policyType,
        category,
        priority,
        objectives: [],
        implementationCost,
        maintenanceCost,
        gdpEffect,
        employmentEffect,
        inflationEffect,
        taxRevenueEffect,
      },
    });
  };

  // Calculate impact preview
  const impactPreview = useMemo(() => {
    if (!country) return null;

    const currentGdp = country.currentGdpPerCapita;
    const currentUnemployment = country.unemploymentRate ?? 5.0;
    const currentInflation = country.inflationRate ?? 2.0;
    const currentTaxRevenue = country.taxRevenueGDPPercent ?? 20.0;

    return {
      gdp: {
        current: currentGdp,
        projected: currentGdp * (1 + gdpEffect / 100),
        change: currentGdp * (gdpEffect / 100),
      },
      unemployment: {
        current: currentUnemployment,
        projected: currentUnemployment * (1 + employmentEffect / 100),
        change: currentUnemployment * (employmentEffect / 100),
      },
      inflation: {
        current: currentInflation,
        projected: currentInflation * (1 + inflationEffect / 100),
        change: currentInflation * (inflationEffect / 100),
      },
      taxRevenue: {
        current: currentTaxRevenue,
        projected: currentTaxRevenue * (1 + taxRevenueEffect / 100),
        change: currentTaxRevenue * (taxRevenueEffect / 100),
      },
    };
  }, [country, gdpEffect, employmentEffect, inflationEffect, taxRevenueEffect]);

  const suitableRecommendations = recommendations?.filter(r => r.meetsRequirements) ?? [];
  const aspirationalRecommendations = recommendations?.filter(r => !r.meetsRequirements) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          width: '100vw',
          maxWidth: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          padding: '24px',
          margin: '0px',
          overflowY: 'auto'
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onOpenChange(false);
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Create New Policy
          </DialogTitle>
          <DialogDescription>
            Design and implement policies to manage your country's domestic affairs. Recommendations are based on your country's current economic tier, stats, and needs.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">
              <Sparkles className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="create">
              <FileText className="h-4 w-4 mr-2" />
              Create Policy
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="h-4 w-4 mr-2" />
              Policy History
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Shows country context and AI recommendations */}
          <TabsContent value="overview" className="space-y-6">
            {/* Country Profile Section */}
            {country && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <Info className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Country Profile</h2>
                    <p className="text-sm text-muted-foreground">Current economic snapshot</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl glass-hierarchy-child border border-white/20">
                    <span className="text-xs text-muted-foreground block mb-1">Economic Tier</span>
                    <div className="font-bold text-lg text-blue-600">{country.economicTier}</div>
                  </div>
                  <div className="p-4 rounded-xl glass-hierarchy-child border border-white/20">
                    <span className="text-xs text-muted-foreground block mb-1">GDP per Capita</span>
                    <div className="font-bold text-lg text-green-600">
                      <NumberFlowDisplay value={country.currentGdpPerCapita} prefix="$" />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl glass-hierarchy-child border border-white/20">
                    <span className="text-xs text-muted-foreground block mb-1">Unemployment</span>
                    <div className="font-bold text-lg text-orange-600">{(country.unemploymentRate ?? 5.0).toFixed(1)}%</div>
                  </div>
                  <div className="p-4 rounded-xl glass-hierarchy-child border border-white/20">
                    <span className="text-xs text-muted-foreground block mb-1">Population</span>
                    <div className="font-bold text-lg text-purple-600">
                      <NumberFlowDisplay value={country.currentPopulation} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* AI Recommendations Section */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Policy Recommendations</h2>
                  <p className="text-sm text-muted-foreground">Personalized policy suggestions based on your country</p>
                </div>
              </div>

              {recommendationsLoading ? (
                <div className="text-center py-12 text-muted-foreground glass-hierarchy-child rounded-xl p-8">
                  <Sparkles className="h-12 w-12 animate-pulse mx-auto mb-4 text-purple-400" />
                  <p className="text-lg font-medium">Analyzing your country...</p>
                  <p className="text-sm">Generating personalized recommendations</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Suitable recommendations */}
                  {suitableRecommendations.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <h3 className="font-bold text-lg">Recommended Policies</h3>
                        <Badge variant="secondary" className="ml-auto">{suitableRecommendations.length} policies</Badge>
                      </div>
                      <div className="space-y-3">

                    {suitableRecommendations.map((rec, index) => (
                      <motion.div
                        key={rec.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => loadRecommendation(rec)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{rec.name}</h4>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  rec.priority === 'critical' ? 'border-red-500 text-red-600' :
                                  rec.priority === 'high' ? 'border-orange-500 text-orange-600' :
                                  'border-blue-500 text-blue-600'
                                }`}
                              >
                                {rec.priority}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {rec.category}
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground mb-3">
                              {rec.description}
                            </p>

                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="h-4 w-4 text-amber-600" />
                              <span className="text-xs font-medium">Why recommended:</span>
                              <span className="text-xs text-muted-foreground">{rec.recommendationReason}</span>
                            </div>

                            {/* Expected effects */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <TrendingUp className={`h-3 w-3 ${rec.estimatedEffects.gdpEffect > 0 ? 'text-green-600' : 'text-red-600'}`} />
                                <span>GDP {rec.estimatedEffects.gdpEffect > 0 ? '+' : ''}{rec.estimatedEffects.gdpEffect}%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className={`h-3 w-3 ${rec.estimatedEffects.employmentEffect < 0 ? 'text-green-600' : 'text-red-600'}`} />
                                <span>Unemployment {rec.estimatedEffects.employmentEffect > 0 ? '+' : ''}{rec.estimatedEffects.employmentEffect}%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className={`h-3 w-3 ${rec.estimatedEffects.taxRevenueEffect > 0 ? 'text-green-600' : 'text-red-600'}`} />
                                <span>Tax Revenue {rec.estimatedEffects.taxRevenueEffect > 0 ? '+' : ''}{rec.estimatedEffects.taxRevenueEffect}%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Cost:</span>
                                <NumberFlowDisplay
                                  value={rec.implementationCost}
                                  prefix="$"
                                  className="font-medium"
                                />
                              </div>
                            </div>

                            {/* Suitability score */}
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Suitability</span>
                                <span className="font-medium">{rec.suitabilityScore}%</span>
                              </div>
                              <Progress value={rec.suitabilityScore} className="h-1.5" />
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                          >
                            Use Template
                          </Button>
                        </div>
                      </motion.div>
                      ))}
                      </div>
                    </div>
                  )}

                  {/* Aspirational recommendations - Collapsible */}
                  {aspirationalRecommendations.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setFutureOpportunitiesExpanded(!futureOpportunitiesExpanded)}
                        className="w-full flex items-center gap-2 mb-4 pb-2 border-b hover:bg-accent/50 transition-colors rounded-t-lg px-2 py-1"
                      >
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <h3 className="font-bold text-lg">Future Opportunities</h3>
                        <Badge variant="outline" className="text-amber-600 border-amber-600">{aspirationalRecommendations.length} policies</Badge>
                        <ChevronDown className={cn(
                          "h-5 w-5 ml-auto transition-transform text-muted-foreground",
                          futureOpportunitiesExpanded && "rotate-180"
                        )} />
                      </button>

                      {futureOpportunitiesExpanded && (
                        <>
                          <p className="text-sm text-muted-foreground mb-3">
                            These policies require additional economic development before implementation
                          </p>
                          <div className="space-y-3">

                    {aspirationalRecommendations.slice(0, 5).map((rec, index) => (
                      <div
                        key={rec.id}
                        className="p-4 border rounded-lg bg-muted/10 opacity-75"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-sm">{rec.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {rec.category}
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground mb-2">
                              {rec.description}
                            </p>

                            <div className="flex items-start gap-2 text-xs">
                              <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium">Missing requirements:</span>
                                <ul className="list-disc list-inside text-muted-foreground">
                                  {rec.missingRequirements.map((req: string) => (
                                    <li key={req}>{req}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                          ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {recommendations && recommendations.length === 0 && (
                    <div className="text-center py-12 glass-hierarchy-child rounded-xl p-8">
                      <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium mb-2">No Recommendations Available</p>
                      <p className="text-sm text-muted-foreground">Create a custom policy using the Create Policy tab</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Create Policy Tab - Combined policy creation with templates and form */}
          <TabsContent value="create" className="space-y-4">
            {/* Template Selector Button */}
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Library className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold">Use a Policy Template</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Start with a pre-configured policy template with realistic economic effects
                </p>
              </div>
              <Button onClick={() => setTemplateSelectorOpen(true)} size="lg">
                <Library className="h-4 w-4 mr-2" />
                Browse Templates
              </Button>
            </div>

            <Separator className="my-6" />

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Policy Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Green Energy Incentive Program"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed description of the policy and its objectives..."
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Policy Type *</Label>
                    <Select value={policyType} onValueChange={(v: any) => setPolicyType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLICY_TYPES.map(type => {
                          const Icon = type.icon;
                          return (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${type.color}`} />
                                {type.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Priority *</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_LEVELS.map(level => (
                          <SelectItem key={level.value} value={level.value}>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${level.color}`} />
                              {level.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., environmental, technology, labor"
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Economic Effects */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Economic Effects
                  <Badge variant="secondary" className="text-xs">Select expected impacts</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose the economic indicators this policy will affect. GDP is calculated automatically based on these effects.
                </p>

                {/* Employment Effect Tags */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Employment Impact</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Major Job Creation', value: -3.0, desc: 'Significantly reduces unemployment' },
                      { label: 'Job Creation', value: -1.5, desc: 'Moderate employment boost' },
                      { label: 'Neutral', value: 0, desc: 'No significant impact' },
                      { label: 'Job Reduction', value: 1.5, desc: 'May increase unemployment' },
                      { label: 'Major Reduction', value: 3.0, desc: 'Significant job losses' },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setEmploymentEffect(option.value)}
                        className={cn(
                          "px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                          employmentEffect === option.value
                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex flex-col items-start">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inflation Effect Tags */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Inflation Impact</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Deflationary', value: -1.0, desc: 'Reduces prices' },
                      { label: 'Minimal Impact', value: 0, desc: 'Stable prices' },
                      { label: 'Low Inflation', value: 0.4, desc: 'Slight price increase' },
                      { label: 'Moderate Inflation', value: 1.0, desc: 'Notable price rise' },
                      { label: 'High Inflation', value: 2.5, desc: 'Significant price surge' },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setInflationEffect(option.value)}
                        className={cn(
                          "px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                          inflationEffect === option.value
                            ? "border-orange-500 bg-orange-50 text-orange-700 shadow-md"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex flex-col items-start">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tax Revenue Effect Tags */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tax Revenue Impact</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Major Loss', value: -2.5, desc: 'Significant revenue decrease' },
                      { label: 'Revenue Loss', value: -0.6, desc: 'Moderate decrease' },
                      { label: 'Neutral', value: 0, desc: 'No change' },
                      { label: 'Revenue Gain', value: 1.0, desc: 'Moderate increase' },
                      { label: 'Major Gain', value: 2.5, desc: 'Significant revenue boost' },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setTaxRevenueEffect(option.value)}
                        className={cn(
                          "px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                          taxRevenueEffect === option.value
                            ? "border-green-500 bg-green-50 text-green-700 shadow-md"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex flex-col items-start">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculated GDP Effect Display */}
                <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Calculated GDP Impact</span>
                    </div>
                    <span className={cn(
                      "text-lg font-bold",
                      gdpEffect > 0 ? "text-green-600" : gdpEffect < 0 ? "text-red-600" : "text-gray-600"
                    )}>
                      {gdpEffect > 0 ? '+' : ''}{gdpEffect.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-blue-700">
                    GDP is automatically calculated based on employment, inflation, and tax revenue impacts. This reflects realistic economic interconnections.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Costs */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Implementation Costs
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="implCost">Implementation Cost</Label>
                    <div className="relative">
                      <Input
                        id="implCost"
                        type="number"
                        value={implementationCost}
                        onChange={(e) => setImplementationCost(parseFloat(e.target.value) || 0)}
                        min={0}
                        step={1000000}
                        className="pr-12"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm text-muted-foreground">
                        <NumberFlowDisplay value={implementationCost} prefix="$" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      One-time implementation cost
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="maintCost">Annual Maintenance Cost</Label>
                    <div className="relative">
                      <Input
                        id="maintCost"
                        type="number"
                        value={maintenanceCost}
                        onChange={(e) => setMaintenanceCost(parseFloat(e.target.value) || 0)}
                        min={0}
                        step={100000}
                        className="pr-12"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm text-muted-foreground">
                        <NumberFlowDisplay value={maintenanceCost} prefix="$" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recurring annual cost
                    </p>
                  </div>
                </div>
              </div>
            </form>

            {/* Floating Economic Impact Preview - Bottom Right */}
            <div className="fixed bottom-24 right-8 z-50">
              {activeTab === 'create' && (
                <Popover>
                  <PopoverTrigger
                    className="p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 glass-hierarchy-interactive border-2 border-blue-500/50"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(99, 102, 241, 0.9))',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <div className="relative">
                      <TrendingUp className="h-6 w-6 text-white" />
                      {impactPreview && (
                        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 border-2 border-white animate-pulse"></div>
                      )}
                    </div>
                  </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="end"
                  className="w-[480px] p-0 glass-hierarchy-modal border-2 border-blue-400/50"
                  style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px) saturate(180%)'
                  }}
                >
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-bold text-lg">Economic Impact Preview</h3>
                    </div>

                    {impactPreview ? (
                      <div className="grid grid-cols-2 gap-3">
                        {/* GDP Impact */}
                        <div className="p-3 rounded-lg glass-hierarchy-child">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">GDP per Capita</span>
                            <Badge variant={gdpEffect > 0 ? 'default' : 'destructive'} className="text-xs">
                              {gdpEffect > 0 ? '+' : ''}{gdpEffect.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-gray-600">
                              <span>Current:</span>
                              <NumberFlowDisplay value={impactPreview.gdp.current} prefix="$" />
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Projected:</span>
                              <NumberFlowDisplay value={impactPreview.gdp.projected} prefix="$" />
                            </div>
                          </div>
                        </div>

                        {/* Unemployment Impact */}
                        <div className="p-3 rounded-lg glass-hierarchy-child">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Unemployment</span>
                            <Badge variant={employmentEffect < 0 ? 'default' : 'destructive'} className="text-xs">
                              {employmentEffect > 0 ? '+' : ''}{employmentEffect.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-gray-600">
                              <span>Current:</span>
                              <span>{impactPreview.unemployment.current.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Projected:</span>
                              <span>{impactPreview.unemployment.projected.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Inflation Impact */}
                        <div className="p-3 rounded-lg glass-hierarchy-child">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Inflation</span>
                            <Badge variant={Math.abs(inflationEffect) < 1 ? 'secondary' : 'destructive'} className="text-xs">
                              {inflationEffect > 0 ? '+' : ''}{inflationEffect.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-gray-600">
                              <span>Current:</span>
                              <span>{impactPreview.inflation.current.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Projected:</span>
                              <span>{impactPreview.inflation.projected.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Tax Revenue Impact */}
                        <div className="p-3 rounded-lg glass-hierarchy-child">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Tax Revenue</span>
                            <Badge variant={taxRevenueEffect > 0 ? 'default' : 'destructive'} className="text-xs">
                              {taxRevenueEffect > 0 ? '+' : ''}{taxRevenueEffect.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-gray-600">
                              <span>Current:</span>
                              <span>{impactPreview.taxRevenue.current.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Projected:</span>
                              <span>{impactPreview.taxRevenue.projected.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>Set economic effects to see preview</p>
                      </div>
                    )}
                  </div>
                </PopoverContent>
                </Popover>
              )}
            </div>
          </TabsContent>

          {/* Policy History Tab */}
          <TabsContent value="history" className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Your Policy History</h3>
              <p className="text-sm text-muted-foreground">
                View and manage all policies you've created for your country
              </p>
            </div>

            {policies && policies.length > 0 ? (
              <div className="space-y-3">
                {policies.map((policy: any) => (
                  <div key={policy.id} className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{policy.name}</h4>
                          <Badge variant={policy.status === 'implemented' ? 'default' : 'secondary'} className="text-xs">
                            {policy.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {policy.policyType}
                          </Badge>
                        </div>
                        {policy.description && (
                          <p className="text-sm text-muted-foreground mb-2">{policy.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {policy.implementationCost && (
                            <span>
                              Cost: <NumberFlowDisplay value={policy.implementationCost} prefix="$" className="font-medium" />
                            </span>
                          )}
                          {policy.createdAt && (
                            <span>Created: {format(new Date(policy.createdAt), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No policies created yet</p>
                <p className="text-sm">Create your first policy to see it here</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createPolicy.isPending || !name.trim() || !description.trim() || !category.trim()}
          >
            {createPolicy.isPending ? 'Creating...' : 'Create Policy'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Policy Template Selector Modal */}
      <PolicyTemplateSelector
        open={templateSelectorOpen}
        onOpenChange={setTemplateSelectorOpen}
        onSelect={loadTemplate}
        economicData={country ? {
          gdp: country.currentGdpPerCapita,
          unemployment: country.unemploymentRate ?? 5.0,
          inflation: country.inflationRate ?? 2.0,
          taxRevenue: country.taxRevenueGDPPercent ?? 20.0,
        } : undefined}
      />
    </Dialog>
  );
}
