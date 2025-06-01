// src/app/countries/_components/economy/CoreEconomicIndicators.tsx
"use client";

import { useState } from "react";
import { DollarSign, Users, TrendingUp, BarChart3, Globe, Coins, Info, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatCurrency, formatPopulation, displayGrowthRate } from "~/lib/chart-utils";
import { getTierStyle } from "~/lib/theme-utils";

export interface CoreEconomicIndicators {
  totalPopulation: number;
  nominalGDP: number;
  gdpPerCapita: number;
  realGDPGrowthRate: number;
  inflationRate: number;
  currencyExchangeRate: number;
}

export interface RealCountryData {
  name: string;
  population: number;
  gdpPerCapita: number;
  taxRevenuePercent: number;
  unemploymentRate: number;
}

interface CoreEconomicIndicatorsProps {
  indicators: CoreEconomicIndicators;
  referenceCountry?: RealCountryData;
  onIndicatorsChangeAction: (indicators: CoreEconomicIndicators) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

function getEconomicTier(gdpPerCapita: number): string {
  if (gdpPerCapita >= 65000) return 'Extravagant';
  if (gdpPerCapita >= 55000) return 'Very Strong';
  if (gdpPerCapita >= 45000) return 'Strong';
  if (gdpPerCapita >= 35000) return 'Healthy';
  if (gdpPerCapita >= 25000) return 'Developed';
  if (gdpPerCapita >= 10000) return 'Developing';
  return 'Impoverished';
}

export function CoreEconomicIndicators({
  indicators,
  referenceCountry,
  onIndicatorsChangeAction,
  isReadOnly = false,
  showComparison = true,
}: CoreEconomicIndicatorsProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed'>('overview');

  const handleInputChange = (field: keyof CoreEconomicIndicators, value: number) => {
    const newIndicators = { ...indicators, [field]: value };
    
    // Auto-calculate derived values
    if (field === 'totalPopulation' || field === 'nominalGDP') {
      newIndicators.gdpPerCapita = newIndicators.nominalGDP / newIndicators.totalPopulation;
    } else if (field === 'gdpPerCapita') {
      newIndicators.nominalGDP = newIndicators.gdpPerCapita * newIndicators.totalPopulation;
    }
    
    onIndicatorsChangeAction(newIndicators);
  };

  const economicTier = getEconomicTier(indicators.gdpPerCapita);
  const tierStyle = getTierStyle(economicTier);

  const comparisonData = referenceCountry ? [
    {
      label: "GDP per Capita",
      userValue: indicators.gdpPerCapita,
      refValue: referenceCountry.gdpPerCapita,
      format: (v: number) => formatCurrency(v),
      icon: DollarSign,
    },
    {
      label: "Population",
      userValue: indicators.totalPopulation,
      refValue: referenceCountry.population,
      format: (v: number) => formatPopulation(v),
      icon: Users,
    },
    {
      label: "Total GDP",
      userValue: indicators.nominalGDP,
      refValue: referenceCountry.population * referenceCountry.gdpPerCapita,
      format: (v: number) => formatCurrency(v),
      icon: Globe,
    },
  ] : [];

  const getHealthIndicator = (growth: number, inflation: number) => {
    if (growth > 0.04 && inflation < 0.03) return { color: "text-green-600", label: "Excellent" };
    if (growth > 0.02 && inflation < 0.05) return { color: "text-blue-600", label: "Good" };
    if (growth > 0 && inflation < 0.08) return { color: "text-yellow-600", label: "Moderate" };
    return { color: "text-red-600", label: "Concerning" };
  };

  const healthIndicator = getHealthIndicator(indicators.realGDPGrowthRate, indicators.inflationRate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Core Economic Indicators
          </h3>
          <p className="text-sm text-muted-foreground">
            Fundamental economic metrics and performance indicators
          </p>
        </div>
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as 'overview' | 'detailed')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <TabsContent value="overview" className="space-y-4">
        {showComparison && referenceCountry && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {comparisonData.map((item) => {
              const Icon = item.icon;
              const difference = ((item.userValue - item.refValue) / item.refValue) * 100;
              const isHigher = difference > 0;
              
              return (
                <Card key={item.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">
                        {item.format(item.userValue)}
                      </div>
                      {item.label === "GDP per Capita" && (
                        <Badge className={tierStyle.className}>{economicTier}</Badge>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Ref: {item.format(item.refValue)}
                      </div>
                      <div className={`text-xs font-medium ${isHigher ? 'text-green-600' : 'text-red-600'}`}>
                        {isHigher ? '+' : ''}{difference.toFixed(1)}% vs {referenceCountry.name}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="detailed" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Population & Output
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="population">Total Population</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">{formatPopulation(indicators.totalPopulation)}</div>
                ) : (
                  <>
                    <Input
                      id="population"
                      type="number"
                      value={indicators.totalPopulation}
                      onChange={(e) => handleInputChange('totalPopulation', parseFloat(e.target.value) || 0)}
                      step="1000"
                    />
                    <div className="text-xs text-muted-foreground">
                      Display: {formatPopulation(indicators.totalPopulation)}
                      {referenceCountry && (
                        <span className="ml-2">
                          Ref: {formatPopulation(referenceCountry.population)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gdpPerCapita">GDP per Capita ($)</Label>
                {isReadOnly ? (
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">{formatCurrency(indicators.gdpPerCapita)}</div>
                    <Badge className={tierStyle.className}>{economicTier}</Badge>
                  </div>
                ) : (
                  <>
                    <Input
                      id="gdpPerCapita"
                      type="number"
                      value={indicators.gdpPerCapita}
                      onChange={(e) => handleInputChange('gdpPerCapita', parseFloat(e.target.value) || 0)}
                      step="100"
                    />
                    <div className="flex items-center justify-between">
                      <Badge className={tierStyle.className}>{economicTier}</Badge>
                      {referenceCountry && (
                        <div className="text-xs text-muted-foreground">
                          Ref: {formatCurrency(referenceCountry.gdpPerCapita)}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nominalGDP">Nominal GDP ($)</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">{formatCurrency(indicators.nominalGDP)}</div>
                ) : (
                  <>
                    <Input
                      id="nominalGDP"
                      type="number"
                      value={indicators.nominalGDP}
                      onChange={(e) => handleInputChange('nominalGDP', parseFloat(e.target.value) || 0)}
                      step="1000000"
                    />
                    <div className="text-xs text-muted-foreground">
                      Display: {formatCurrency(indicators.nominalGDP)}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Growth & Stability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gdpGrowth">Real GDP Growth Rate</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">{displayGrowthRate(indicators.realGDPGrowthRate)}</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[indicators.realGDPGrowthRate * 100]}
                        onValueChange={(value) => handleInputChange('realGDPGrowthRate', value[0]! / 100)}
                        max={10}
                        min={-5}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>-5%</span>
                      <span className="font-medium text-foreground">
                        {displayGrowthRate(indicators.realGDPGrowthRate)}
                      </span>
                      <span>10%</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="inflation">Inflation Rate</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">{displayGrowthRate(indicators.inflationRate)}</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[indicators.inflationRate * 100]}
                        onValueChange={(value) => handleInputChange('inflationRate', value[0]! / 100)}
                        max={15}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span className="font-medium text-foreground">
                        {displayGrowthRate(indicators.inflationRate)}
                      </span>
                      <span>15%</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="exchangeRate">Currency Exchange Rate</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">{indicators.currencyExchangeRate.toFixed(2)}</div>
                ) : (
                  <>
                    <Input
                      id="exchangeRate"
                      type="number"
                      value={indicators.currencyExchangeRate}
                      onChange={(e) => handleInputChange('currencyExchangeRate', parseFloat(e.target.value) || 1)}
                      step="0.01"
                      min="0.01"
                    />
                    <div className="text-xs text-muted-foreground">
                      Value relative to USD (1.0 = parity)
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">
            Economic Health: <span className={healthIndicator.color}>{healthIndicator.label}</span>
          </div>
          <div className="text-sm">
            Based on {displayGrowthRate(indicators.realGDPGrowthRate)} growth and {displayGrowthRate(indicators.inflationRate)} inflation. 
            Optimal: 2-4% growth with 2-3% inflation for sustainable development.
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}