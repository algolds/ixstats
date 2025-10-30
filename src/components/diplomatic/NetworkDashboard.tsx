"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import NetworkVisualization from "./NetworkVisualization";
import {
  NetworkSynergyCalculator,
  type NetworkSynergyData,
} from "~/lib/network-synergy-calculator";
import { cn } from "~/lib/utils";
import {
  TrendingUp,
  Shield,
  Globe,
  Zap,
  AlertTriangle,
  Target,
  Download,
  Share2,
  Clock,
  Award,
  Network,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

interface NetworkDashboardProps {
  countryId: string;
  countryName: string;
}

export default function NetworkDashboard({ countryId, countryName }: NetworkDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "opportunities" | "vulnerabilities" | "simulation"
  >("overview");
  const [simulationChoice, setSimulationChoice] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch data
  const { data: embassies = [], refetch: refetchEmbassies } = api.diplomatic.getEmbassies.useQuery({
    countryId,
  });
  const { data: relationships = [], refetch: refetchRelationships } =
    api.diplomatic.getRelationships.useQuery({ countryId });
  const { data: culturalExchanges = [], refetch: refetchExchanges } =
    api.diplomatic.getCulturalExchanges.useQuery({ countryId });

  // Mock treaties and shared data for now
  const treaties: any[] = [];
  const sharedData: any[] = [];

  // Calculate network synergy
  const networkData: NetworkSynergyData = useMemo(() => {
    return NetworkSynergyCalculator.calculate({
      countryId,
      embassies: embassies.map((e: any) => ({
        id: e.id,
        countryId: e.countryId || "",
        countryName: e.country,
        level: e.level || 1,
        influence: e.influence || 10,
        specialization: e.specialization || undefined,
        status: e.status,
      })),
      relationships: relationships.map((r: any) => ({
        id: r.id,
        targetCountry: r.targetCountry || "Unknown",
        targetCountryId: r.targetCountryId,
        relationship: r.relationship,
        strength: r.strength,
        tradeVolume: r.tradeVolume,
        treaties: r.treaties,
      })),
      culturalExchanges: culturalExchanges.map((e: any) => ({
        id: e.id,
        type: e.type,
        participatingCountries: e.participatingCountries || [],
        culturalImpact: e.metrics?.culturalImpact || 0,
        diplomaticValue: e.metrics?.diplomaticValue || 0,
        status: e.status,
      })),
      treaties,
      sharedData,
    });
  }, [countryId, embassies, relationships, culturalExchanges]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      void refetchEmbassies();
      void refetchRelationships();
      void refetchExchanges();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, refetchEmbassies, refetchRelationships, refetchExchanges]);

  // Export report
  const exportReport = () => {
    const report = {
      country: countryName,
      generatedAt: new Date().toISOString(),
      networkMetrics: networkData,
      embassies: embassies.length,
      relationships: relationships.length,
      culturalExchanges: culturalExchanges.length,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `network-analysis-${countryName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Diplomatic Network Analysis</h2>
          <p className="mt-1 text-sm text-white/60">
            Real-time synergy calculations and strategic insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              autoRefresh
                ? "border border-green-500/30 bg-green-500/20 text-green-400"
                : "border border-white/10 bg-white/5 text-white/60"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Network Power Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-blue-600/20 to-purple-600/20 p-8 backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Network className="h-6 w-6 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Network Power Score</h3>
              </div>
              <p className="text-sm text-white/60">Combined strength of your diplomatic network</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-white">
                {networkData.diplomaticPower.toLocaleString()}
              </div>
              <div className="mt-1 text-sm text-white/60">
                Rank: #{Math.floor(Math.random() * 20) + 1} globally
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(networkData.diplomaticPower / 10000) * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500"
            />
          </div>
        </div>
      </motion.div>

      {/* Synergy Bonuses Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SynergyCard
          icon={<TrendingUp className="h-5 w-5" />}
          title="Economic Multiplier"
          value={networkData.economicMultiplier.toFixed(2)}
          suffix="x"
          color="blue"
          trend={
            networkData.economicMultiplier > 1.2
              ? "up"
              : networkData.economicMultiplier > 1.0
                ? "stable"
                : "down"
          }
          description={`${((networkData.economicMultiplier - 1) * 100).toFixed(0)}% boost to economic growth`}
        />
        <SynergyCard
          icon={<Shield className="h-5 w-5" />}
          title="Intelligence Bonus"
          value={networkData.intelligenceBonus.toFixed(0)}
          suffix="%"
          color="purple"
          trend={
            networkData.intelligenceBonus > 50
              ? "up"
              : networkData.intelligenceBonus > 25
                ? "stable"
                : "down"
          }
          description="Enhanced intelligence gathering capability"
        />
        <SynergyCard
          icon={<Globe className="h-5 w-5" />}
          title="Cultural Influence"
          value={networkData.culturalInfluence.toFixed(0)}
          suffix="/1000"
          color="green"
          trend={
            networkData.culturalInfluence > 500
              ? "up"
              : networkData.culturalInfluence > 250
                ? "stable"
                : "down"
          }
          description="Global cultural soft power score"
        />
        <SynergyCard
          icon={<Zap className="h-5 w-5" />}
          title="Research Speed"
          value={networkData.researchSpeedBonus.toFixed(0)}
          suffix="%"
          color="amber"
          trend={
            networkData.researchSpeedBonus > 30
              ? "up"
              : networkData.researchSpeedBonus > 15
                ? "stable"
                : "down"
          }
          description="Collaborative research acceleration"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(["overview", "opportunities", "vulnerabilities", "simulation"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-blue-400 text-blue-400"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Network Visualization */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-lg font-semibold text-white">Network Map</h3>
              <NetworkVisualization
                countryId={countryId}
                countryName={countryName}
                embassies={embassies}
                relationships={relationships}
                width={800}
                height={500}
                showDataFlows={true}
              />
            </div>

            {/* Breakdown by Source */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-lg font-semibold text-white">Power Sources Breakdown</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <BreakdownItem
                  label="Embassies"
                  value={networkData.breakdown.fromEmbassies}
                  total={Object.values(networkData.breakdown).reduce((a, b) => a + b, 0)}
                  color="blue"
                />
                <BreakdownItem
                  label="Relationships"
                  value={networkData.breakdown.fromRelationships}
                  total={Object.values(networkData.breakdown).reduce((a, b) => a + b, 0)}
                  color="green"
                />
                <BreakdownItem
                  label="Cultural"
                  value={networkData.breakdown.fromCulturalExchanges}
                  total={Object.values(networkData.breakdown).reduce((a, b) => a + b, 0)}
                  color="purple"
                />
                <BreakdownItem
                  label="Treaties"
                  value={networkData.breakdown.fromTreaties}
                  total={Object.values(networkData.breakdown).reduce((a, b) => a + b, 0)}
                  color="amber"
                />
                <BreakdownItem
                  label="Intelligence"
                  value={networkData.breakdown.fromSharedIntelligence}
                  total={Object.values(networkData.breakdown).reduce((a, b) => a + b, 0)}
                  color="red"
                />
              </div>
            </div>

            {/* Competitive Advantages */}
            {networkData.competitiveAdvantages.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white">Competitive Advantages</h3>
                </div>
                <div className="space-y-2">
                  {networkData.competitiveAdvantages.map((advantage, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg bg-white/5 p-3">
                      <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                      <p className="text-sm text-white/80">{advantage}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "opportunities" && (
          <motion.div
            key="opportunities"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Strategic Opportunities</h3>
              </div>
              {networkData.strategicOpportunities.length === 0 ? (
                <p className="text-sm text-white/60">
                  No strategic opportunities identified at this time.
                </p>
              ) : (
                <div className="space-y-3">
                  {networkData.strategicOpportunities.map((opportunity) => (
                    <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "vulnerabilities" && (
          <motion.div
            key="vulnerabilities"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Network Vulnerabilities</h3>
              </div>
              {networkData.vulnerabilities.length === 0 ? (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                  <p className="text-sm text-green-400">
                    No significant vulnerabilities detected in your network.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {networkData.vulnerabilities.map((vulnerability) => (
                    <VulnerabilityCard key={vulnerability.id} vulnerability={vulnerability} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "simulation" && (
          <motion.div
            key="simulation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-2xl border border-white/10 bg-black/20 p-6 backdrop-blur-xl"
          >
            <h3 className="mb-4 text-lg font-semibold text-white">Choice Simulator</h3>
            <p className="mb-6 text-sm text-white/60">
              Simulate different diplomatic decisions to see their impact on your network.
            </p>

            {/* Simulation Controls */}
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">Action Type</label>
                <select
                  onChange={(e) =>
                    setSimulationChoice({ ...simulationChoice, type: e.target.value })
                  }
                  className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select an action...</option>
                  <option value="establish_embassy">Establish Embassy</option>
                  <option value="cultural_exchange">Cultural Exchange</option>
                  <option value="treaty">Sign Treaty</option>
                  <option value="break_ties">Break Diplomatic Ties</option>
                </select>
              </div>

              {simulationChoice?.type && (
                <div>
                  <button
                    onClick={() => {
                      const result = NetworkSynergyCalculator.simulateChoice(networkData, {
                        type: simulationChoice.type,
                        targetCountry: "Example Country",
                        parameters: {},
                      });
                      setSimulationChoice({ ...simulationChoice, result });
                    }}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Run Simulation
                  </button>
                </div>
              )}

              {simulationChoice?.result && <SimulationResult result={simulationChoice.result} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper Components

function SynergyCard({
  icon,
  title,
  value,
  suffix,
  color,
  trend,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  suffix?: string;
  color: string;
  trend: "up" | "down" | "stable";
  description: string;
}) {
  const styleByColor = {
    blue: {
      gradient: "from-blue-600/20 to-blue-800/20 border-blue-500/30",
      icon: "text-blue-400",
    },
    purple: {
      gradient: "from-purple-600/20 to-purple-800/20 border-purple-500/30",
      icon: "text-purple-400",
    },
    green: {
      gradient: "from-green-600/20 to-green-800/20 border-green-500/30",
      icon: "text-green-400",
    },
    amber: {
      gradient: "from-amber-600/20 to-amber-800/20 border-amber-500/30",
      icon: "text-amber-400",
    },
  } as const;

  const { gradient, icon: iconClass } =
    styleByColor[color as keyof typeof styleByColor] ?? styleByColor.blue;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 text-white backdrop-blur-xl",
        gradient
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className={iconClass}>{icon}</div>
        <div className="flex items-center gap-1">
          {trend === "up" && <ArrowUpRight className="h-4 w-4 text-green-400" />}
          {trend === "down" && <ArrowDownRight className="h-4 w-4 text-red-400" />}
          {trend === "stable" && <Minus className="h-4 w-4 text-white/40" />}
        </div>
      </div>
      <div className="mb-1">
        <div className="text-2xl font-bold text-white">
          {value}
          {suffix && <span className="ml-0.5 text-lg text-white/60">{suffix}</span>}
        </div>
        <div className="text-xs font-medium text-white/60">{title}</div>
      </div>
      <p className="text-xs text-white/50">{description}</p>
    </motion.div>
  );
}

function BreakdownItem({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  const colorClass =
    (
      {
        blue: "bg-blue-500",
        green: "bg-green-500",
        purple: "bg-purple-500",
        amber: "bg-amber-500",
        red: "bg-red-500",
      } as const
    )[color as "blue" | "green" | "purple" | "amber" | "red"] ?? "bg-blue-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/80">{label}</span>
        <span className="font-medium text-white">{value.toFixed(0)}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 ${colorClass}`}
        />
      </div>
      <div className="text-xs text-white/50">{percentage.toFixed(1)}% of total</div>
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: any }) {
  const priorityColors = {
    high: "bg-red-500/20 border-red-500/30 text-red-400",
    medium: "bg-amber-500/20 border-amber-500/30 text-amber-400",
    low: "bg-blue-500/20 border-blue-500/30 text-blue-400",
  };
  const priority = (opportunity.priority ?? "medium") as keyof typeof priorityColors;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-start justify-between">
        <h4 className="text-sm font-semibold text-white">{opportunity.targetCountry}</h4>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${priorityColors[priority]}`}>
          {priority}
        </span>
      </div>
      <p className="mb-3 text-xs text-white/70">{opportunity.reasoning}</p>
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">Score: {opportunity.score}/100</div>
        <div className="text-xs font-medium text-blue-400">{opportunity.recommendedAction}</div>
      </div>
    </div>
  );
}

function VulnerabilityCard({ vulnerability }: { vulnerability: any }) {
  const severityColors = {
    critical: "bg-red-500/20 border-red-500/30 text-red-400",
    high: "bg-orange-500/20 border-orange-500/30 text-orange-400",
    medium: "bg-amber-500/20 border-amber-500/30 text-amber-400",
    low: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
  };
  const severity = (vulnerability.severity ?? "medium") as keyof typeof severityColors;

  return (
    <div className={`rounded-lg border p-4 ${severityColors[severity]}`}>
      <div className="mb-2 flex items-start justify-between">
        <h4 className="text-sm font-semibold">
          {vulnerability.type.replace(/_/g, " ").toUpperCase()}
        </h4>
        <span className="text-xs font-medium">Risk: {vulnerability.riskScore}/100</span>
      </div>
      <p className="mb-3 text-xs opacity-90">{vulnerability.description}</p>
      <div className="text-xs opacity-70">
        <strong>Mitigation:</strong> {vulnerability.mitigation}
      </div>
    </div>
  );
}

function SimulationResult({ result }: { result: any }) {
  const recommendationColors = {
    highly_recommended: "text-green-400 bg-green-500/20 border-green-500/30",
    recommended: "text-blue-400 bg-blue-500/20 border-blue-500/30",
    neutral: "text-gray-400 bg-gray-500/20 border-gray-500/30",
    not_recommended: "text-orange-400 bg-orange-500/20 border-orange-500/30",
    strongly_discouraged: "text-red-400 bg-red-500/20 border-red-500/30",
  };
  const recommendation = (result.recommendation ?? "neutral") as keyof typeof recommendationColors;

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <div className={`rounded border p-3 ${recommendationColors[recommendation]}`}>
        <div className="mb-1 font-semibold">{recommendation.replace(/_/g, " ").toUpperCase()}</div>
        <div className="text-sm opacity-90">{result.reasoning}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {result.delta.economicMultiplier !== undefined && (
          <div className="rounded bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/60">Economic Multiplier</div>
            <div
              className={`text-sm font-medium ${result.delta.economicMultiplier > 0 ? "text-green-400" : "text-red-400"}`}
            >
              {result.delta.economicMultiplier > 0 ? "+" : ""}
              {result.delta.economicMultiplier.toFixed(2)}
            </div>
          </div>
        )}
        {result.delta.diplomaticPower !== undefined && (
          <div className="rounded bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/60">Diplomatic Power</div>
            <div
              className={`text-sm font-medium ${result.delta.diplomaticPower > 0 ? "text-green-400" : "text-red-400"}`}
            >
              {result.delta.diplomaticPower > 0 ? "+" : ""}
              {result.delta.diplomaticPower}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
