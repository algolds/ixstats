"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  Target,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CardEconomyAnalyticsProps {
  countryId: string;
  userId: string;
}

/**
 * CardEconomyAnalytics Component
 *
 * Intelligence dashboard component for analyzing IxCards economy
 * Features:
 * - Overview: Summary metrics with nation card value and GDP correlation
 * - Value Trends: Historical line chart with 30-day card value + GDP overlay
 * - Correlation Analysis: Scatter plot of card value vs GDP
 * - Portfolio: User's owned cards performance table
 * - Market Activity: Recent transactions list
 */
export function CardEconomyAnalytics({ countryId, userId }: CardEconomyAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Fetch economy overview
  const { data: economyData, isLoading: economyLoading } =
    api.cardAnalytics.getCardEconomyData.useQuery(
      { countryId },
      { enabled: !!countryId }
    );

  // Fetch portfolio performance
  const { data: portfolioData, isLoading: portfolioLoading } =
    api.cardAnalytics.getPortfolioPerformance.useQuery(
      { userId },
      { enabled: !!userId }
    );

  // Fetch value history (for top card or selected card)
  const cardIdForHistory = selectedCardId || economyData?.topCard?.id || "";
  const { data: valueHistory, isLoading: historyLoading } =
    api.cardAnalytics.getCardValueHistory.useQuery(
      { cardId: cardIdForHistory, days: 30 },
      { enabled: !!cardIdForHistory }
    );

  // Fetch GDP correlation
  const { data: correlationData, isLoading: correlationLoading } =
    api.cardAnalytics.getCardGDPCorrelation.useQuery(
      { cardId: cardIdForHistory },
      { enabled: !!cardIdForHistory }
    );

  // Fetch market activity
  const { data: marketActivity, isLoading: activityLoading } =
    api.cardAnalytics.getCardMarketActivity.useQuery(
      { cardId: cardIdForHistory, limit: 20 },
      { enabled: !!cardIdForHistory }
    );

  if (economyLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="space-y-4 text-center">
          <Activity className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="text-muted-foreground text-sm">Loading card economy analytics...</p>
        </div>
      </div>
    );
  }

  if (!economyData) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <BarChart3 className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
        <h3 className="mb-1 text-sm font-semibold">No Card Economy Data</h3>
        <p className="mx-auto max-w-md text-xs">
          Card economy analytics will appear once cards are minted for this country.
        </p>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-4">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Nation Card Value */}
        <Card className="glass-hierarchy-interactive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Nation Card Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {economyData.nationCardValue.toFixed(2)} IxC
            </div>
            <div className="flex items-center gap-1 text-sm mt-1">
              {economyData.changePercent >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span
                className={
                  economyData.changePercent >= 0 ? "text-green-600" : "text-red-600"
                }
              >
                {economyData.changePercent.toFixed(2)}% (30d)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* GDP Correlation */}
        <Card className="glass-hierarchy-interactive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              GDP Correlation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(economyData.gdpCorrelation * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {economyData.gdpCorrelation >= 0.7
                ? "Strong positive"
                : economyData.gdpCorrelation >= 0.4
                  ? "Moderate positive"
                  : "Weak correlation"}
            </div>
          </CardContent>
        </Card>

        {/* Total Cards */}
        <Card className="glass-hierarchy-interactive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Total Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{economyData.totalCards}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {economyData.totalValue.toFixed(2)} IxC total value
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Card */}
      {economyData.topCard && (
        <Card className="glass-hierarchy-interactive">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{economyData.topCard.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{economyData.topCard.rarity}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {economyData.topCard.value.toFixed(2)} IxC
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCardId(economyData.topCard?.id || null)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View Details
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderValueTrends = () => {
    if (historyLoading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="space-y-2 text-center">
            <Activity className="mx-auto h-6 w-6 animate-spin text-blue-600" />
            <p className="text-muted-foreground text-sm">Loading value trends...</p>
          </div>
        </div>
      );
    }

    if (!valueHistory || valueHistory.history.length === 0) {
      return (
        <div className="text-muted-foreground py-8 text-center">
          <TrendingUp className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
          <h3 className="mb-1 text-sm font-semibold">No Historical Data</h3>
          <p className="mx-auto max-w-md text-xs">Value trend data will appear once cards begin trading.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{valueHistory.cardTitle}</h3>
            <p className="text-sm text-muted-foreground">
              Current Value: {valueHistory.currentValue.toFixed(2)} IxC
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={valueHistory.history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis yAxisId="left" stroke="#3B82F6" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" stroke="#10B981" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(17, 24, 39, 0.95)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#F9FAFB" }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cardValue"
              stroke="#3B82F6"
              strokeWidth={2}
              name="Card Value (IxC)"
              dot={false}
            />
            {valueHistory.history[0]?.gdpValue && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="gdpValue"
                stroke="#10B981"
                strokeWidth={2}
                name="GDP per Capita"
                dot={false}
                strokeDasharray="5 5"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderCorrelationAnalysis = () => {
    if (correlationLoading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="space-y-2 text-center">
            <Activity className="mx-auto h-6 w-6 animate-spin text-blue-600" />
            <p className="text-muted-foreground text-sm">Calculating correlation...</p>
          </div>
        </div>
      );
    }

    if (!correlationData || correlationData.dataPoints.length === 0) {
      return (
        <div className="text-muted-foreground py-8 text-center">
          <Target className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
          <h3 className="mb-1 text-sm font-semibold">No Correlation Data</h3>
          <p className="mx-auto max-w-md text-xs">{correlationData?.message || "Correlation analysis requires sufficient historical trading data."}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{correlationData.cardTitle}</h3>
            <p className="text-sm text-muted-foreground">
              Correlation Coefficient: <strong>{correlationData.correlation}</strong>
              {correlationData.correlation >= 0.7
                ? " (Strong positive)"
                : correlationData.correlation >= 0.4
                  ? " (Moderate positive)"
                  : " (Weak correlation)"}
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="gdpPerCapita"
              name="GDP per Capita"
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
            />
            <YAxis dataKey="cardValue" name="Card Value" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                backgroundColor: "rgba(17, 24, 39, 0.95)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#F9FAFB" }}
              formatter={(value: number, name: string) => [
                name === "Card Value" ? `${value.toFixed(2)} IxC` : value.toLocaleString(),
                name,
              ]}
            />
            <Scatter name="Data Points" data={correlationData.dataPoints} fill="#3B82F6" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderPortfolio = () => {
    if (portfolioLoading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="space-y-2 text-center">
            <Activity className="mx-auto h-6 w-6 animate-spin text-blue-600" />
            <p className="text-muted-foreground text-sm">Loading portfolio...</p>
          </div>
        </div>
      );
    }

    if (!portfolioData || portfolioData.totalCards === 0) {
      return (
        <div className="text-muted-foreground py-8 text-center">
          <Briefcase className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
          <h3 className="mb-1 text-sm font-semibold">No Cards in Portfolio</h3>
          <p className="mx-auto max-w-md text-xs">Acquire cards from the Vault to see portfolio analytics here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="glass-hierarchy-interactive">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{portfolioData.totalCards}</div>
            </CardContent>
          </Card>

          <Card className="glass-hierarchy-interactive">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{portfolioData.totalValue.toFixed(2)} IxC</div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performer */}
        {portfolioData.topPerformer && (
          <Card className="glass-hierarchy-interactive">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                Top Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{portfolioData.topPerformer.title}</div>
                  <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                    +{portfolioData.topPerformer.gain.toFixed(2)} IxC (
                    {portfolioData.topPerformer.gainPercent.toFixed(1)}%)
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">
                    {portfolioData.topPerformer.currentValue.toFixed(2)} IxC
                  </div>
                  <div className="text-muted-foreground">Current</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Acquisitions */}
        <Card className="glass-hierarchy-interactive">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Acquisitions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {portfolioData.recentAcquisitions.map((card) => (
                <div
                  key={card.cardId}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <div className="font-medium text-sm">{card.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Acquired: {new Date(card.acquiredAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{card.currentValue.toFixed(2)} IxC</div>
                    <div
                      className={
                        card.currentValue >= card.acquisitionPrice
                          ? "text-green-600 text-xs"
                          : "text-red-600 text-xs"
                      }
                    >
                      {card.currentValue >= card.acquisitionPrice ? "+" : ""}
                      {(card.currentValue - card.acquisitionPrice).toFixed(2)} IxC
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderMarketActivity = () => {
    if (activityLoading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="space-y-2 text-center">
            <Activity className="mx-auto h-6 w-6 animate-spin text-blue-600" />
            <p className="text-muted-foreground text-sm">Loading market activity...</p>
          </div>
        </div>
      );
    }

    if (!marketActivity || marketActivity.activities.length === 0) {
      return (
        <div className="text-muted-foreground py-8 text-center">
          <Activity className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
          <h3 className="mb-1 text-sm font-semibold">No Market Activity</h3>
          <p className="mx-auto max-w-md text-xs">Recent card transactions will appear here once trading begins.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-2">Recent Transactions</h3>
          <p className="text-sm text-muted-foreground">
            {marketActivity.totalActivities} recent activities
          </p>
        </div>

        <div className="space-y-2">
          {marketActivity.activities.map((activity) => (
            <Card
              key={activity.id}
              className="glass-hierarchy-interactive border-border hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={activity.type === "BUYOUT" ? "default" : "outline"}
                      className={
                        activity.type === "BUYOUT"
                          ? "bg-green-600"
                          : activity.type === "SALE"
                            ? "bg-blue-600"
                            : ""
                      }
                    >
                      {activity.type}
                    </Badge>
                    <div>
                      <div className="font-medium text-sm">{activity.cardTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{activity.price} IxC</div>
                    <div className="text-xs text-muted-foreground">{activity.status}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold">IxCards Economy Analytics</h3>
        <span className="text-muted-foreground text-xs">Card economy analysis with GDP correlation</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 gap-0.5">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-xs sm:text-sm">
            Trends
          </TabsTrigger>
          <TabsTrigger value="correlation" className="text-xs sm:text-sm">
            Correlation
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="text-xs sm:text-sm">
            Portfolio
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm">
            Market
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {renderValueTrends()}
        </TabsContent>

        <TabsContent value="correlation" className="space-y-4">
          {renderCorrelationAnalysis()}
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-4">
          {renderPortfolio()}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          {renderMarketActivity()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
