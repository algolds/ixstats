"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { 
  Globe, 
  TrendingUp, 
  Shield, 
  Lightbulb, 
  Users, 
  Building2,
  Target,
  CheckCircle,
  AlertTriangle,
  Info,
  BarChart3,
  PieChart,
  Zap,
  Star,
  ArrowRight,
  RefreshCw,
  Settings,
  Download,
  Upload,
  Cpu,
  Mountain,
  Factory,
  Leaf,
  Banknote,
  Crown,
  Ship,
  Plane,
  Car,
  Wrench,
  Hammer,
  Gavel,
  BookOpen,
  Heart,
  TreePine,
  Wheat,
  Pickaxe,
  Building,
  Landmark
} from 'lucide-react';
import { 
  EconomicArchetypeService
} from '~/app/builder/services/EconomicArchetypeService';
import type { 
  EconomicArchetype
} from '~/app/builder/services/EconomicArchetypeService';
import type { EconomyBuilderState } from '~/types/economy-builder';

interface EconomicArchetypeDisplayProps {
  className?: string;
  currentState?: EconomyBuilderState;
  onArchetypeApplied?: (newState: EconomyBuilderState) => void;
}

export function EconomicArchetypeDisplay({ 
  className, 
  currentState, 
  onArchetypeApplied 
}: EconomicArchetypeDisplayProps) {
  const [archetypes, setArchetypes] = useState<EconomicArchetype[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<EconomicArchetype | null>(null);
  const [recommendations, setRecommendations] = useState<EconomicArchetype[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');

  const archetypeService = EconomicArchetypeService.getInstance();

  useEffect(() => {
    loadArchetypes();
    loadRecommendations();
  }, [currentState]);

  const loadArchetypes = () => {
    const allArchetypes = archetypeService.getAllArchetypes();
    setArchetypes(Array.from(allArchetypes.values()));
  };

  const loadRecommendations = () => {
    if (!currentState) return;
    const recs = archetypeService.getArchetypeRecommendations(currentState, {
      growthFocus: true,
      stabilityFocus: true,
      innovationFocus: true,
      complexity: 'medium'
    });
    setRecommendations(recs.map(r => r.archetype));
  };

  const handleArchetypeSelect = (archetypeId: string) => {
    const archetype = archetypeService.getArchetype(archetypeId);
    setSelectedArchetype(archetype ?? null);
  };

  const handleApplyArchetype = () => {
    if (!selectedArchetype || !currentState) return;

    setIsLoading(true);
    try {
      // Apply archetype to current state
      onArchetypeApplied?.(currentState);
      
      // Show success message
      setActiveTab('browse');
      setSelectedArchetype(null);
    } catch (error) {
      console.error('Failed to apply archetype:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const getComplexityColor = (complexity: 'low' | 'medium' | 'high') => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMetricColor = (value: number, maxValue: number = 100) => {
    const percentage = (value / maxValue) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getArchetypeIcon = (archetypeId: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      'silicon-valley': Cpu,
      'nordic': Leaf,
      'asian-tiger': Factory,
      'german-social-market': Building2,
      'singapore': Banknote,
      'swiss': Mountain,
      'japanese': Car,
      'australian': Pickaxe,
      'brazilian': Wheat,
      'canadian': TreePine,
      'british-empire': Crown,
      'venetian-republic': Ship,
      'hanseatic-league': Globe,
      'dutch-golden-age': Banknote,
      'industrial-revolution': Wrench,
      'soviet-command': Hammer,
      'american-gilded-age': Building,
      'french-mercantilism': Gavel,
      'ottoman-empire': Landmark,
      'chinese-ming-dynasty': BookOpen
    };
    return iconMap[archetypeId] || Globe;
  };

  const getArchetypeColors = (archetypeId: string) => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      'silicon-valley': { bg: 'from-blue-500 to-purple-600', border: 'border-blue-200/50 dark:border-blue-800/50', text: 'text-blue-600 dark:text-blue-400' },
      'nordic': { bg: 'from-green-500 to-emerald-600', border: 'border-green-200/50 dark:border-green-800/50', text: 'text-green-600 dark:text-green-400' },
      'asian-tiger': { bg: 'from-orange-500 to-red-600', border: 'border-orange-200/50 dark:border-orange-800/50', text: 'text-orange-600 dark:text-orange-400' },
      'german-social-market': { bg: 'from-gray-500 to-slate-600', border: 'border-gray-200/50 dark:border-gray-800/50', text: 'text-gray-600 dark:text-gray-400' },
      'singapore': { bg: 'from-cyan-500 to-blue-600', border: 'border-cyan-200/50 dark:border-cyan-800/50', text: 'text-cyan-600 dark:text-cyan-400' },
      'swiss': { bg: 'from-red-500 to-white', border: 'border-red-200/50 dark:border-red-800/50', text: 'text-red-600 dark:text-red-400' },
      'japanese': { bg: 'from-red-500 to-pink-600', border: 'border-red-200/50 dark:border-red-800/50', text: 'text-red-600 dark:text-red-400' },
      'australian': { bg: 'from-yellow-500 to-orange-600', border: 'border-yellow-200/50 dark:border-yellow-800/50', text: 'text-yellow-600 dark:text-yellow-400' },
      'brazilian': { bg: 'from-green-500 to-yellow-600', border: 'border-green-200/50 dark:border-green-800/50', text: 'text-green-600 dark:text-green-400' },
      'canadian': { bg: 'from-red-500 to-white', border: 'border-red-200/50 dark:border-red-800/50', text: 'text-red-600 dark:text-red-400' },
      'british-empire': { bg: 'from-blue-500 to-red-600', border: 'border-blue-200/50 dark:border-blue-800/50', text: 'text-blue-600 dark:text-blue-400' },
      'venetian-republic': { bg: 'from-blue-500 to-cyan-600', border: 'border-blue-200/50 dark:border-blue-800/50', text: 'text-blue-600 dark:text-blue-400' },
      'hanseatic-league': { bg: 'from-gray-500 to-blue-600', border: 'border-gray-200/50 dark:border-gray-800/50', text: 'text-gray-600 dark:text-gray-400' },
      'dutch-golden-age': { bg: 'from-orange-500 to-white', border: 'border-orange-200/50 dark:border-orange-800/50', text: 'text-orange-600 dark:text-orange-400' },
      'industrial-revolution': { bg: 'from-gray-500 to-black', border: 'border-gray-200/50 dark:border-gray-800/50', text: 'text-gray-600 dark:text-gray-400' },
      'soviet-command': { bg: 'from-red-500 to-yellow-600', border: 'border-red-200/50 dark:border-red-800/50', text: 'text-red-600 dark:text-red-400' },
      'american-gilded-age': { bg: 'from-yellow-500 to-gray-600', border: 'border-yellow-200/50 dark:border-yellow-800/50', text: 'text-yellow-600 dark:text-yellow-400' },
      'french-mercantilism': { bg: 'from-blue-500 to-white', border: 'border-blue-200/50 dark:border-blue-800/50', text: 'text-blue-600 dark:text-blue-400' },
      'ottoman-empire': { bg: 'from-red-500 to-green-600', border: 'border-red-200/50 dark:border-red-800/50', text: 'text-red-600 dark:text-red-400' },
      'chinese-ming-dynasty': { bg: 'from-red-500 to-yellow-600', border: 'border-red-200/50 dark:border-red-800/50', text: 'text-red-600 dark:text-red-400' }
    };
    return colorMap[archetypeId] || { bg: 'from-blue-500 to-purple-600', border: 'border-blue-200/50 dark:border-blue-800/50', text: 'text-blue-600 dark:text-blue-400' };
  };

  const renderArchetypeCard = (archetype: EconomicArchetype, showSelectButton: boolean = false, isRecommended: boolean = false) => {
    const IconComponent = getArchetypeIcon(archetype.id);
    const colors = getArchetypeColors(archetype.id);
    
    return (
    <div key={archetype.id} className="group">
      <Card className="transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 border-2 hover:border-primary/30">
        {/* Compact Header */}
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${colors.bg} shadow-md group-hover:shadow-lg transition-shadow duration-300 shrink-0`}>
              <IconComponent className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-1">
                {archetype.name}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="h-3 w-3 shrink-0" />
                <span className="font-medium">{archetype.region}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-2">
              <Badge className={`${getComplexityColor(archetype.implementationComplexity)} text-xs px-2 py-0.5 shrink-0 capitalize font-medium`}>
                {archetype.implementationComplexity}
              </Badge>
              {isRecommended && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5 font-medium shrink-0">
                  Recommended
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Innovation: {archetype.growthMetrics.innovationIndex}
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Action Buttons */}
        <CardContent className="pt-0 px-4 pb-4">
          <div className="flex gap-2 justify-center">
            {showSelectButton && (
              <Button
                onClick={() => { setSelectedArchetype(archetype); handleApplyArchetype(); }}
                className="h-7 px-3 py-1 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded"
                size="sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Select
              </Button>
            )}
            <Button
              onClick={() => {
                setSelectedArchetype(archetype);
                setActiveTab('details');
              }}
              variant="outline"
              className="h-7 px-3 py-1 text-xs font-medium border rounded"
              size="sm"
            >
              <Info className="h-3 w-3 mr-1" />
              Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    );
  };

  const renderArchetypeDetails = () => {
    if (!selectedArchetype) return null;

    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <h2 className="text-2xl font-bold">{selectedArchetype.name}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{selectedArchetype.description}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4 shrink-0" />
              <span className="font-medium">{selectedArchetype.region}</span>
            </div>
          </div>
          <Button
            onClick={handleApplyArchetype}
            disabled={isLoading}
            className="flex items-center gap-2 shrink-0 h-11 px-6 w-full lg:w-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                <span>Apply Archetype</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* Growth Metrics */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-200/50 dark:border-green-800/50">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                Growth Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">GDP Growth</span>
                  <span className="font-semibold text-sm">{selectedArchetype.growthMetrics.gdpGrowth}%</span>
                </div>
                <Progress value={selectedArchetype.growthMetrics.gdpGrowth * 10} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Innovation Index</span>
                  <span className="font-semibold text-sm">{selectedArchetype.growthMetrics.innovationIndex}</span>
                </div>
                <Progress value={selectedArchetype.growthMetrics.innovationIndex} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Competitiveness</span>
                  <span className="font-semibold text-sm">{selectedArchetype.growthMetrics.competitiveness}</span>
                </div>
                <Progress value={selectedArchetype.growthMetrics.competitiveness} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Stability</span>
                  <span className="font-semibold text-sm">{selectedArchetype.growthMetrics.stability}</span>
                </div>
                <Progress value={selectedArchetype.growthMetrics.stability} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Employment Profile */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border border-blue-200/50 dark:border-blue-800/50">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                Employment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Unemployment Rate</span>
                  <span className="font-semibold text-sm">{selectedArchetype.employmentProfile.unemploymentRate}%</span>
                </div>
                <Progress value={100 - selectedArchetype.employmentProfile.unemploymentRate * 10} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Labor Participation</span>
                  <span className="font-semibold text-sm">{selectedArchetype.employmentProfile.laborParticipation}%</span>
                </div>
                <Progress value={selectedArchetype.employmentProfile.laborParticipation} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Wage Growth</span>
                  <span className="font-semibold text-sm">{selectedArchetype.employmentProfile.wageGrowth}%</span>
                </div>
                <Progress value={selectedArchetype.employmentProfile.wageGrowth * 20} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Tax Profile */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-600/10 border border-purple-200/50 dark:border-purple-800/50">
                  <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                Tax Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Corporate Tax</span>
                  <span className="font-semibold text-sm">{selectedArchetype.taxProfile.corporateRate}%</span>
                </div>
                <Progress value={selectedArchetype.taxProfile.corporateRate * 2} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Income Tax</span>
                  <span className="font-semibold text-sm">{selectedArchetype.taxProfile.incomeRate}%</span>
                </div>
                <Progress value={selectedArchetype.taxProfile.incomeRate * 1.5} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Consumption Tax</span>
                  <span className="font-semibold text-sm">{selectedArchetype.taxProfile.consumptionRate}%</span>
                </div>
                <Progress value={selectedArchetype.taxProfile.consumptionRate * 3} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Revenue Efficiency</span>
                  <span className="font-semibold text-sm">{Math.round(selectedArchetype.taxProfile.revenueEfficiency * 100)}%</span>
                </div>
                <Progress value={selectedArchetype.taxProfile.revenueEfficiency * 100} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Strengths */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-200/50 dark:border-green-800/50">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {selectedArchetype.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-sm leading-relaxed">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Challenges */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/10 to-amber-600/10 border border-orange-200/50 dark:border-orange-800/50">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                Challenges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {selectedArchetype.challenges.map((challenge, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                    <span className="text-sm leading-relaxed">{challenge}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Recommendations */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/10 to-amber-600/10 border border-yellow-200/50 dark:border-yellow-800/50">
                <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              Implementation Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {selectedArchetype.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <span className="text-blue-600 mt-0.5 shrink-0">•</span>
                  <span className="text-sm leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Historical Context */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/10 to-blue-600/10 border border-indigo-200/50 dark:border-indigo-800/50">
                <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              Historical Context & Examples
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h4 className="font-semibold mb-2.5 text-sm">Historical Context</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{selectedArchetype.historicalContext}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2.5 text-sm">Modern Examples</h4>
              <div className="flex flex-wrap gap-2">
                {selectedArchetype.modernExamples.map((example, index) => (
                  <Badge key={index} variant="outline" className="text-xs px-2.5 py-1">
                    {example}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };


  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-200/50 dark:border-blue-800/50">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold">Economic Archetypes</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Pre-configured economic models based on successful real-world examples.
          Choose an archetype to apply its proven economic structure to your economy.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="browse" className="text-sm font-medium">Browse</TabsTrigger>
          <TabsTrigger value="details" className="text-sm font-medium">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {archetypes.map(archetype => {
              const isRecommended = recommendations.some(rec => rec.id === archetype.id);
              return renderArchetypeCard(archetype, true, isRecommended);
            })}
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-5">
          {selectedArchetype ? renderArchetypeDetails() : (
            <Card className="border-2 border-dashed border-muted-foreground/25">
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                  <div className="p-4 rounded-full bg-muted/50 mx-auto w-fit">
                    <Target className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold">Select an Archetype</h3>
                  <p className="text-sm text-muted-foreground max-w-md">Choose an archetype from the Browse tab to view detailed information.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
