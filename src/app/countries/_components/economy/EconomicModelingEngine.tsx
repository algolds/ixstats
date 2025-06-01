// src/app/countries/_components/economy/EconomicModelingEngine.tsx
"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp,
  Calculator,
  BarChart3,
  PieChart,
  Activity,
  Target,
  AlertTriangle,
  Info,
  Settings,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  AreaChart,
  BarChart,
} from 'recharts';
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface EconomicSector {
  name: string;
  gdpContribution: number; // percentage
  employmentShare: number; // percentage
  productivityGrowth: number; // annual %
  capitalIntensity: number; // 0-100 scale
  innovationLevel: number; // 0-100 scale
  color: string;
}

interface ModelingParameters {
  timeHorizon: number; // years
  populationGrowthRate: number; // annual %
  baseTFPGrowth: number; // total factor productivity
  capitalDepreciation: number; // annual %
  investmentRate: number; // % of GDP
  educationSpending: number; // % of GDP
  rdSpending: number; // % of GDP
  tradeFactor: number; // openness multiplier
}

interface EconomicProjection {
  year: number;
  gdp: number;
  gdpPerCapita: number;
  population: number;
  sectors: Record<string, number>;
  productivity: number;
  unemploymentRate: number;
  inflationRate: number;
}

interface EconomicModelingEngineProps {
  countryId: string;
  countryName: string;
  baselineEconomy: {
    gdp: number;
    population: number;
    gdpPerCapita: number;
    sectors: EconomicSector[];
    unemployment: number;
    inflation: number;
  };
  onProjectionChange?: (projections: EconomicProjection[]) => void;
}

const defaultSectors: EconomicSector[] = [
  {
    name: "Agriculture",
    gdpContribution: 15,
    employmentShare: 25,
    productivityGrowth: 1.5,
    capitalIntensity: 30,
    innovationLevel: 20,
    color: "#10B981"
  },
  {
    name: "Manufacturing",
    gdpContribution: 25,
    employmentShare: 20,
    productivityGrowth: 3.0,
    capitalIntensity: 70,
    innovationLevel: 60,
    color: "#3B82F6"
  },
  {
    name: "Services",
    gdpContribution: 45,
    employmentShare: 40,
    productivityGrowth: 2.5,
    capitalIntensity: 40,
    innovationLevel: 75,
    color: "#8B5CF6"
  },
  {
    name: "Technology",
    gdpContribution: 10,
    employmentShare: 10,
    productivityGrowth: 5.5,
    capitalIntensity: 80,
    innovationLevel: 95,
    color: "#F59E0B"
  },
  {
    name: "Resources",
    gdpContribution: 5,
    employmentShare: 5,
    productivityGrowth: 1.0,
    capitalIntensity: 90,
    innovationLevel: 25,
    color: "#EF4444"
  },
];

export function EconomicModelingEngine({
  countryId,
  countryName,
  baselineEconomy,
  onProjectionChange,
}: EconomicModelingEngineProps) {
  const [sectors, setSectors] = useState<EconomicSector[]>(
    baselineEconomy.sectors.length > 0 ? baselineEconomy.sectors : defaultSectors
  );
  
  const [parameters, setParameters] = useState<ModelingParameters>({
    timeHorizon: 20,
    populationGrowthRate: 1.2,
    baseTFPGrowth: 1.5,
    capitalDepreciation: 5.0,
    investmentRate: 22,
    educationSpending: 5.5,
    rdSpending: 2.5,
    tradeFactor: 1.0,
  });

  const [selectedScenario, setSelectedScenario] = useState<'baseline' | 'optimistic' | 'pessimistic' | 'custom'>('baseline');
  const [activeTab, setActiveTab] = useState<'projections' | 'sectors' | 'scenarios'>('projections');

  // Calculate economic projections
  const projections = useMemo(() => {
    return calculateEconomicProjections(
      baselineEconomy,
      sectors,
      parameters,
      selectedScenario
    );
  }, [baselineEconomy, sectors, parameters, selectedScenario]);

  // Calculate sector growth contributions
  const sectorGrowthContributions = useMemo(() => {
    return sectors.map(sector => {
      const weightedGrowth = (sector.gdpContribution / 100) * sector.productivityGrowth;
      const innovationBonus = (sector.innovationLevel / 100) * 0.5;
      const finalContribution = weightedGrowth + innovationBonus;
      
      return {
        ...sector,
        growthContribution: finalContribution,
        projectedGrowth: sector.productivityGrowth + innovationBonus,
      };
    });
  }, [sectors]);

  const handleSectorChange = (index: number, field: keyof EconomicSector, value: number) => {
    const newSectors = [...sectors];
    if (newSectors[index]) {
      newSectors[index] = {
        ...newSectors[index],
        [field]: value
      };
      setSectors(newSectors);
    }
  };

  const handleParameterChange = (field: keyof ModelingParameters, value: number) => {
    setParameters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyScenario = (scenario: typeof selectedScenario) => {
    setSelectedScenario(scenario);
    
    let adjustments: Partial<ModelingParameters> = {};
    
    switch (scenario) {
      case 'optimistic':
        adjustments = {
          baseTFPGrowth: parameters.baseTFPGrowth * 1.5,
          investmentRate: parameters.investmentRate * 1.3,
          rdSpending: parameters.rdSpending * 1.8,
          tradeFactor: 1.2,
        };
        break;
      case 'pessimistic':
        adjustments = {
          baseTFPGrowth: parameters.baseTFPGrowth * 0.6,
          investmentRate: parameters.investmentRate * 0.8,
          rdSpending: parameters.rdSpending * 0.7,
          tradeFactor: 0.8,
        };
        break;
      case 'baseline':
        // Reset to baseline - no adjustments needed
        break;
      case 'custom':
        // Keep current parameters
        break;
    }
    
    if (Object.keys(adjustments).length > 0) {
      setParameters(prev => ({ ...prev, ...adjustments }));
    }
  };

  const totalGrowthRate = useMemo(() => {
    const sectorContribution = sectorGrowthContributions.reduce(
      (sum, sector) => sum + sector.growthContribution, 0
    );
    
    const tfpContribution = parameters.baseTFPGrowth;
    const investmentContribution = (parameters.investmentRate / 100) * 2.5;
    const educationContribution = (parameters.educationSpending / 100) * 1.5;
    const rdContribution = (parameters.rdSpending / 100) * 3.0;
    
    return (sectorContribution + tfpContribution + investmentContribution + 
            educationContribution + rdContribution) * parameters.tradeFactor;
  }, [sectorGrowthContributions, parameters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Economic Modeling Engine
          </h3>
          <p className="text-sm text-muted-foreground">
            Advanced economic projections for {countryName}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedScenario} onValueChange={(value: any) => applyScenario(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baseline">Baseline</SelectItem>
              <SelectItem value="optimistic">Optimistic</SelectItem>
              <SelectItem value="pessimistic">Pessimistic</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Export Model
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <Badge variant={totalGrowthRate > 4 ? "default" : totalGrowthRate > 2 ? "secondary" : "destructive"}>
                {totalGrowthRate > 4 ? "High" : totalGrowthRate > 2 ? "Moderate" : "Low"}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{totalGrowthRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Projected GDP Growth</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Target className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(projections[projections.length - 1]?.gdpPerCapita || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              GDP per Capita ({parameters.timeHorizon}Y)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Activity className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">
              {sectorGrowthContributions.reduce((max, sector) => 
                sector.growthContribution > max.growthContribution ? sector : max
              ).name}
            </div>
            <p className="text-xs text-muted-foreground">Leading Growth Sector</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Zap className="h-4 w-4 text-yellow-600" />
            </div>
            <div className="text-2xl font-bold">
              {((projections[projections.length - 1]?.gdp || baselineEconomy.gdp) / baselineEconomy.gdp).toFixed(1)}x
            </div>
            <p className="text-xs text-muted-foreground">GDP Multiplier</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList>
          <TabsTrigger value="projections">Projections</TabsTrigger>
          <TabsTrigger value="sectors">Sector Analysis</TabsTrigger>
          <TabsTrigger value="scenarios">Scenario Planning</TabsTrigger>
        </TabsList>

        <TabsContent value="projections" className="space-y-6">
          {/* Economic Projections Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Economic Growth Projections</CardTitle>
              <CardDescription>
                GDP and GDP per capita growth over {parameters.timeHorizon} years
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projections}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name.includes('GDP') ? formatCurrency(value) : value.toFixed(1),
                        name
                      ]}
                    />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="gdp" 
                      fill="#3B82F6" 
                      fillOpacity={0.3}
                      stroke="#3B82F6"
                      name="GDP (Billions)"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="gdpPerCapita" 
                      stroke="#10B981"
                      strokeWidth={3}
                      name="GDP per Capita"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Parameters Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Model Parameters</CardTitle>
              <CardDescription>Adjust key economic factors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Time Horizon (years)</Label>
                    <Slider
                      value={[parameters.timeHorizon]}
                      onValueChange={([value]) => handleParameterChange('timeHorizon', value)}
                      max={50}
                      min={5}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-sm text-muted-foreground">{parameters.timeHorizon} years</div>
                  </div>

                  <div>
                    <Label>Population Growth Rate (%)</Label>
                    <Slider
                      value={[parameters.populationGrowthRate]}
                      onValueChange={([value]) => handleParameterChange('populationGrowthRate', value)}
                      max={5}
                      min={-2}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-sm text-muted-foreground">{parameters.populationGrowthRate.toFixed(1)}% annually</div>
                  </div>

                  <div>
                    <Label>Investment Rate (% of GDP)</Label>
                    <Slider
                      value={[parameters.investmentRate]}
                      onValueChange={([value]) => handleParameterChange('investmentRate', value)}
                      max={50}
                      min={10}
                      step={0.5}
                      className="w-full"
                    />
                    <div className="text-sm text-muted-foreground">{parameters.investmentRate.toFixed(1)}% of GDP</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>R&D Spending (% of GDP)</Label>
                    <Slider
                      value={[parameters.rdSpending]}
                      onValueChange={([value]) => handleParameterChange('rdSpending', value)}
                      max={8}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-sm text-muted-foreground">{parameters.rdSpending.toFixed(1)}% of GDP</div>
                  </div>

                  <div>
                    <Label>Education Spending (% of GDP)</Label>
                    <Slider
                      value={[parameters.educationSpending]}
                      onValueChange={([value]) => handleParameterChange('educationSpending', value)}
                      max={15}
                      min={1}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-sm text-muted-foreground">{parameters.educationSpending.toFixed(1)}% of GDP</div>
                  </div>

                  <div>
                    <Label>Trade Factor</Label>
                    <Slider
                      value={[parameters.tradeFactor]}
                      onValueChange={([value]) => handleParameterChange('tradeFactor', value)}
                      max={2}
                      min={0.5}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-sm text-muted-foreground">
                      {parameters.tradeFactor.toFixed(1)}x {parameters.tradeFactor > 1 ? '(Open)' : parameters.tradeFactor < 1 ? '(Closed)' : '(Neutral)'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sectors" className="space-y-6">
          {/* Sector Growth Contributions */}
          <Card>
            <CardHeader>
              <CardTitle>Sector Growth Contributions</CardTitle>
              <CardDescription>Economic impact by sector</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorGrowthContributions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Growth Contribution']}
                    />
                    <Bar dataKey="growthContribution" name="Growth Contribution">
                      {sectorGrowthContributions.map((sector, index) => (
                        <Cell key={`cell-${index}`} fill={sector.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sector Configuration */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold">Sector Configuration</h4>
            {sectors.map((sector, index) => (
              <Card key={sector.name}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: sector.color }}
                    />
                    <h5 className="font-medium">{sector.name}</h5>
                    <Badge variant="outline">
                      {sector.gdpContribution.toFixed(1)}% GDP
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs">GDP Contribution (%)</Label>
                      <Slider
                        value={[sector.gdpContribution]}
                        onValueChange={([value]) => handleSectorChange(index, 'gdpContribution', value)}
                        max={60}
                        min={1}
                        step={0.5}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground">{sector.gdpContribution.toFixed(1)}%</div>
                    </div>

                    <div>
                      <Label className="text-xs">Productivity Growth (%)</Label>
                      <Slider
                        value={[sector.productivityGrowth]}
                        onValueChange={([value]) => handleSectorChange(index, 'productivityGrowth', value)}
                        max={8}
                        min={-2}
                        step={0.1}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground">{sector.productivityGrowth.toFixed(1)}%</div>
                    </div>

                    <div>
                      <Label className="text-xs">Innovation Level</Label>
                      <Slider
                        value={[sector.innovationLevel]}
                        onValueChange={([value]) => handleSectorChange(index, 'innovationLevel', value)}
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground">{sector.innovationLevel}/100</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          {/* Scenario Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Scenario Comparison</CardTitle>
              <CardDescription>Compare different economic scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {(['baseline', 'optimistic', 'pessimistic'] as const).map((scenario) => (
                  <div 
                    key={scenario}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedScenario === scenario 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => applyScenario(scenario)}
                  >
                    <h5 className="font-medium capitalize mb-2">{scenario} Scenario</h5>
                    <div className="text-sm text-muted-foreground">
                      {scenario === 'baseline' && "Standard economic conditions with current trends"}
                      {scenario === 'optimistic' && "High investment, innovation, and trade openness"}
                      {scenario === 'pessimistic' && "Reduced investment and slower productivity growth"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h6 className="font-medium text-sm mb-1">Model Assumptions</h6>
                    <p className="text-xs text-muted-foreground">
                      This model uses endogenous growth theory with sector-specific productivity functions. 
                      Results are projections based on current economic structure and may not account for 
                      external shocks, policy changes, or technological disruptions.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to calculate economic projections
function calculateEconomicProjections(
  baseline: any,
  sectors: EconomicSector[],
  params: ModelingParameters,
  scenario: string
): EconomicProjection[] {
  const projections: EconomicProjection[] = [];
  
  let currentGDP = baseline.gdp;
  let currentPopulation = baseline.population;
  
  // Scenario adjustments
  let scenarioMultiplier = 1.0;
  if (scenario === 'optimistic') scenarioMultiplier = 1.2;
  if (scenario === 'pessimistic') scenarioMultiplier = 0.8;
  
  for (let year = 0; year <= params.timeHorizon; year++) {
    // Population growth
    currentPopulation *= (1 + params.populationGrowthRate / 100);
    
    // GDP growth calculation
    const sectorGrowth = sectors.reduce((total, sector) => {
      const sectorContribution = (sector.gdpContribution / 100) * 
        (sector.productivityGrowth + (sector.innovationLevel / 100) * 0.5);
      return total + sectorContribution;
    }, 0);
    
    const tfpGrowth = params.baseTFPGrowth;
    const investmentGrowth = (params.investmentRate / 100) * 2.5;
    const educationGrowth = (params.educationSpending / 100) * 1.5;
    const rdGrowth = (params.rdSpending / 100) * 3.0;
    
    const totalGrowthRate = (sectorGrowth + tfpGrowth + investmentGrowth + 
      educationGrowth + rdGrowth) * params.tradeFactor * scenarioMultiplier;
    
    currentGDP *= (1 + totalGrowthRate / 100);
    
    const sectorBreakdown: Record<string, number> = {};
    sectors.forEach(sector => {
      sectorBreakdown[sector.name] = (currentGDP * sector.gdpContribution) / 100;
    });
    
    projections.push({
      year: new Date().getFullYear() + year,
      gdp: currentGDP,
      gdpPerCapita: currentGDP / currentPopulation,
      population: currentPopulation,
      sectors: sectorBreakdown,
      productivity: 100 + (year * totalGrowthRate),
      unemploymentRate: Math.max(2, baseline.unemployment * (1 - totalGrowthRate / 200)),
      inflationRate: Math.max(0.5, baseline.inflation + (totalGrowthRate - 3) * 0.2),
    });
  }
  
  return projections;
}