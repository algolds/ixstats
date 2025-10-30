/**
 * Economic Intelligence Card Component
 *
 * Displays comprehensive economic analysis in an expandable dialog with multiple tabs.
 * This is a simplified extraction - the full implementation would include all tabs and charts.
 */

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatCurrency } from "~/lib/chart-utils";
import type { UnsplashImageData } from "~/lib/unsplash-service";
import { RiMoneyDollarCircleLine } from "react-icons/ri";

interface EconomicIntelligenceCardProps {
  country: {
    name: string;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    adjustedGdpGrowth: number;
  };
  flagColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  backgroundImage?: UnsplashImageData;
}

export const EconomicIntelligenceCard = React.memo<EconomicIntelligenceCardProps>(({
  country,
  flagColors,
  backgroundImage,
}) => {
  const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);

  return (
    <Card className="glass-hierarchy-child relative overflow-hidden">
      {backgroundImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={backgroundImage.url}
            alt={backgroundImage.description || 'Economic analysis background'}
            className="w-full h-full object-cover object-center blur-sm"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-background/70"></div>
        </div>
      )}
      <CardContent className="relative z-10 p-6">
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:scale-[1.01] transition-all duration-300 border border-border/50 hover:border-border group">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                        <RiMoneyDollarCircleLine className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">GDP & Economic Analysis</h3>
                        <p className="text-sm text-muted-foreground">Complete economic intelligence profile</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs group-hover:bg-primary/10">Click to Expand</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">GDP per Capita</div>
                      <div className="text-lg font-semibold">{formatCurrency(country.currentGdpPerCapita)}</div>
                      <div className="text-xs text-amber-600 dark:text-amber-400">{country.economicTier}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Economic Health</div>
                      <div className="text-lg font-semibold">{economicHealth.toFixed(1)}%</div>
                      <div className="text-xs text-green-600 dark:text-green-400">Growth: {(country.adjustedGdpGrowth * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="!max-w-none !w-[96vw] !h-[96vh] !max-h-none overflow-y-auto !left-[2vw] !top-[2vh] !translate-x-0 !translate-y-0 backdrop-blur-xl bg-background/80 border border-border/50">
            <DialogHeader className="backdrop-blur-md bg-background/60 rounded-lg p-6 mb-6 border border-border/30">
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <RiMoneyDollarCircleLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                GDP & Economic Intelligence Analysis - {country.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-8 p-8 max-w-7xl mx-auto w-full">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="backdrop-blur-md bg-background/70 border border-border/30 grid w-full grid-cols-4 max-w-2xl mx-auto">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="historical">Historical Trends</TabsTrigger>
                  <TabsTrigger value="analysis">Economic Analysis</TabsTrigger>
                  <TabsTrigger value="projections">Projections</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="backdrop-blur-sm bg-background/40 rounded-lg p-6 mt-6 border border-border/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20">
                      <div className="text-sm font-medium mb-2">Current GDP/Capita</div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(country.currentGdpPerCapita)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{country.economicTier}</p>
                    </div>
                    <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20">
                      <div className="text-sm font-medium mb-2">Growth Rate</div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                        {(country.adjustedGdpGrowth * 100).toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">annually</p>
                    </div>
                    <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20">
                      <div className="text-sm font-medium mb-2">Total GDP</div>
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                        {formatCurrency(country.currentTotalGdp)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">total economy</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="historical" className="mt-6">
                  <div className="text-center text-muted-foreground p-8">
                    Historical trend analysis would appear here with interactive charts.
                  </div>
                </TabsContent>

                <TabsContent value="analysis" className="mt-6">
                  <div className="text-center text-muted-foreground p-8">
                    Economic analysis framework would appear here.
                  </div>
                </TabsContent>

                <TabsContent value="projections" className="mt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 3, 5, 10].map(years => {
                      const projected = country.currentGdpPerCapita * Math.pow(1 + country.adjustedGdpGrowth, years);
                      return (
                        <div key={years} className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-lg font-semibold">{formatCurrency(projected)}</div>
                          <div className="text-sm text-muted-foreground">Year +{years}</div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
});

EconomicIntelligenceCard.displayName = "EconomicIntelligenceCard";
