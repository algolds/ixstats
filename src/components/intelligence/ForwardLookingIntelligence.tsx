// Forward-Looking Intelligence Component - Phase 4 Advanced Features
// AI-driven predictive intelligence display with interactive analytics

"use client";

import { useMemo, useState, memo, useEffect } from "react";
import type { FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Brain,
  Clock,
  Zap,
  BarChart3,
} from "lucide-react";
import { predictiveAnalyticsEngine } from "~/lib/predictive-analytics-engine";
import { useOptimizedIntelligenceData } from "~/hooks/useOptimizedIntelligenceData";
// PerformanceUtils import removed - doesn't exist in performance-monitor
// ForwardIntelligence type - using local definition since it's not exported
interface ForwardIntelligence {
  generated: number;
  countryId: string;
  dataQuality: "excellent" | "good" | "fair" | "limited";
  economicProjections: any[];
  riskAssessment: any;
  competitiveIntelligence: any;
  milestoneForecasts: any;
  actionableInsights: any[];
  modelMetadata: any;
}

interface ForwardLookingIntelligenceProps {
  countryId: string;
  viewMode?: "executive" | "analyst" | "overview";
  className?: string;
}

interface ProjectionDisplayProps {
  projections: ForwardIntelligence["economicProjections"];
  selectedHorizon: string;
  onHorizonChange: (horizon: string) => void;
}

interface RiskAssessmentDisplayProps {
  riskAssessment: ForwardIntelligence["riskAssessment"];
}

interface MilestoneTimelineProps {
  milestones: ForwardIntelligence["milestoneForecasts"];
}

interface ActionableInsightsProps {
  insights: ForwardIntelligence["actionableInsights"];
}

/**
 * Advanced Forward-Looking Intelligence Component
 * Displays AI-generated predictive analytics and strategic intelligence
 */
const ForwardLookingIntelligence: FC<ForwardLookingIntelligenceProps> = memo(
  ({ countryId, viewMode = "overview", className = "" }) => {
    const [selectedHorizon, setSelectedHorizon] = useState<string>("90d");
    const [activeTab, setActiveTab] = useState<
      "projections" | "risks" | "competitive" | "milestones" | "insights"
    >("projections");
    const [isGenerating, setIsGenerating] = useState(false);
    const [forwardIntelligence, setForwardIntelligence] = useState<ForwardIntelligence | null>(
      null
    );
    const [error, setError] = useState<string | null>(null);

    // Get optimized intelligence data
    const { country, intelligence, vitality, isLoading } = useOptimizedIntelligenceData({
      countryId,
      enableIntelligence: true,
      enableVitality: true,
      staleTime: 60000, // 1 minute for forward intelligence
    });

    // Generate forward intelligence when data is available
    useEffect(() => {
      if (country && intelligence && !isGenerating && !forwardIntelligence) {
        generateForwardIntelligence();
      }
    }, [country, intelligence, isGenerating, forwardIntelligence]);

    const generateForwardIntelligence = async () => {
      if (!country || !intelligence) return;

      setIsGenerating(true);
      setError(null);

      try {
        // Mock historical data generation (in production, this would come from your database)
        const historicalData = generateMockHistoricalData(country);

        const forward = await predictiveAnalyticsEngine.generateForwardIntelligence(
          country,
          historicalData
        );

        setForwardIntelligence(forward);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate forward intelligence");
        console.error("Forward intelligence generation failed:", err);
      } finally {
        setIsGenerating(false);
      }
    };

    // Loading state
    if (isLoading || isGenerating) {
      return <ForwardIntelligenceLoadingSkeleton />;
    }

    // Error state
    if (error) {
      return <ForwardIntelligenceError error={error} onRetry={generateForwardIntelligence} />;
    }

    // No data state
    if (!forwardIntelligence || !country) {
      return <ForwardIntelligenceEmptyState countryId={countryId} />;
    }

    return (
      <div className={`forward-intelligence-container ${className}`}>
        {/* Header with AI Indicator */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-purple-300/30 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-3 py-1">
                <Brain className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-200">AI-Powered Intelligence</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                <span>Generated {formatTimeAgo(forwardIntelligence.generated)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`rounded px-2 py-1 text-xs font-medium ${getDataQualityStyle(forwardIntelligence.dataQuality)}`}
              >
                {forwardIntelligence.dataQuality} data quality
              </div>
              <div className="text-muted-foreground text-xs">
                {forwardIntelligence.modelMetadata.accuracy * 100}% accuracy
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-4 flex gap-2">
            {[
              { key: "projections", label: "Projections", icon: TrendingUp },
              { key: "risks", label: "Risk Analysis", icon: AlertTriangle },
              { key: "competitive", label: "Competitive", icon: BarChart3 },
              { key: "milestones", label: "Milestones", icon: Target },
              { key: "insights", label: "Insights", icon: Zap },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-200 ${
                  activeTab === key
                    ? "bg-accent text-accent-foreground shadow-lg"
                    : "hover:bg-accent/50 text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Panels */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "projections" && (
              <ProjectionDisplay
                projections={forwardIntelligence.economicProjections}
                selectedHorizon={selectedHorizon}
                onHorizonChange={setSelectedHorizon}
              />
            )}

            {activeTab === "risks" && (
              <RiskAssessmentDisplay riskAssessment={forwardIntelligence.riskAssessment} />
            )}

            {activeTab === "competitive" && (
              <CompetitiveIntelligenceDisplay
                competitive={forwardIntelligence.competitiveIntelligence}
              />
            )}

            {activeTab === "milestones" && (
              <MilestoneTimeline milestones={forwardIntelligence.milestoneForecasts} />
            )}

            {activeTab === "insights" && (
              <ActionableInsights insights={forwardIntelligence.actionableInsights} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Model Metadata Footer */}
        {viewMode === "analyst" && (
          <div className="border-border mt-6 border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-muted-foreground">Algorithms</div>
                <div className="font-medium">
                  {forwardIntelligence.modelMetadata.algorithmsUsed.length}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Data Points</div>
                <div className="font-medium">{forwardIntelligence.modelMetadata.dataPoints}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Training Period</div>
                <div className="font-medium">
                  {forwardIntelligence.modelMetadata.trainingPeriod}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Model Accuracy</div>
                <div className="font-medium">
                  {Math.round(forwardIntelligence.modelMetadata.accuracy * 100)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

/**
 * Economic Projections Display Component
 */
const ProjectionDisplay: React.FC<ProjectionDisplayProps> = ({
  projections,
  selectedHorizon,
  onHorizonChange,
}) => {
  const selectedProjection =
    projections.find((p) => p.timeHorizon === selectedHorizon) || projections[0];

  if (!selectedProjection) {
    return (
      <div className="text-muted-foreground py-8 text-center">No projection data available</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Horizon Selector */}
      <div className="flex gap-2">
        {projections.map((projection) => (
          <button
            key={projection.timeHorizon}
            onClick={() => onHorizonChange(projection.timeHorizon)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              selectedHorizon === projection.timeHorizon
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {projection.timeHorizon === "30d"
              ? "30 Days"
              : projection.timeHorizon === "90d"
                ? "90 Days"
                : projection.timeHorizon === "1y"
                  ? "1 Year"
                  : "5 Years"}
          </button>
        ))}
      </div>

      {/* Main Projection Display */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* GDP Projection */}
        <div className="glass-card glass-depth-parent p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">GDP Projection</h3>
            <div className="flex items-center gap-1 text-green-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">{selectedProjection.confidence * 100}% confident</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold">
                ${formatLargeNumber(selectedProjection.projectedGdp)}
              </div>
              <div className="text-muted-foreground text-sm">Projected total GDP</div>
            </div>

            {/* Scenarios */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Scenarios:</div>
              {Object.entries(selectedProjection.scenarios).map(([scenario, data]) => (
                <div key={scenario} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{scenario}:</span>
                  <span className="text-sm font-medium">
                    ${formatLargeNumber((data as any).gdp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Population Projection */}
        <div className="glass-card glass-depth-parent p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Population Projection</h3>
            <div className="flex items-center gap-1 text-blue-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Demographic trends</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold">
                {formatLargeNumber(selectedProjection.projectedPopulation)}
              </div>
              <div className="text-muted-foreground text-sm">Projected population</div>
            </div>

            <div>
              <div className="text-lg font-medium">Tier {selectedProjection.projectedTier}</div>
              <div className="text-muted-foreground text-sm">Economic classification</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Factors */}
      <div className="glass-card glass-depth-child p-4">
        <h4 className="mb-3 font-medium">Key Projection Factors</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {selectedProjection.keyFactors.map((factor: any, index: number) => (
            <div key={index} className="flex items-start gap-2">
              <div className="bg-accent mt-2 h-2 w-2 flex-shrink-0 rounded-full" />
              <span className="text-sm">{factor}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology */}
      <div className="text-muted-foreground text-xs">
        <span className="font-medium">Methodology:</span> {selectedProjection.methodology}
      </div>
    </div>
  );
};

/**
 * Risk Assessment Display Component
 */
const RiskAssessmentDisplay: React.FC<RiskAssessmentDisplayProps> = ({ riskAssessment }) => {
  return (
    <div className="space-y-6">
      {/* Overall Risk Score */}
      <div className="glass-card glass-depth-parent p-6 text-center">
        <div className="mb-4">
          <div className={`text-4xl font-bold ${getRiskColor(riskAssessment.overallRisk)}`}>
            {riskAssessment.riskScore}
          </div>
          <div className="text-muted-foreground text-sm">Overall Risk Score</div>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${getRiskBadgeStyle(riskAssessment.overallRisk)}`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium capitalize">{riskAssessment.overallRisk} Risk</span>
        </div>
      </div>

      {/* Risk Factors Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(riskAssessment.riskFactors || {}).map(([category, risk]: [string, any]) => (
          <div key={category} className="glass-card glass-depth-child p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-medium capitalize">{category} Risk</h4>
              <div
                className={`rounded px-2 py-1 text-xs font-medium ${getRiskLevelStyle(risk.level)}`}
              >
                {risk.level}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Impact Score:</span>
                <span className="font-medium">{risk.impact}%</span>
              </div>

              <div>
                <div className="mb-1 text-sm font-medium">Risk Factors:</div>
                <ul className="space-y-1">
                  {(risk.factors || []).map((factor: any, index: number) => (
                    <li
                      key={index}
                      className="text-muted-foreground flex items-start gap-2 text-sm"
                    >
                      <span className="bg-muted-foreground mt-2 h-1 w-1 flex-shrink-0 rounded-full" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mitigation Strategies */}
      <div className="glass-card glass-depth-parent p-6">
        <div className="mb-4 flex items-center gap-2">
          <Target className="text-accent h-5 w-5" />
          <h3 className="font-semibold">Mitigation Strategies</h3>
          <div
            className={`rounded px-2 py-1 text-xs font-medium ${getPriorityStyle(riskAssessment.mitigation.priority)}`}
          >
            {riskAssessment.mitigation.priority} priority
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 font-medium">Short-term Actions</h4>
            <ul className="space-y-2">
              {(riskAssessment.mitigation?.shortTerm || []).map((action: any, index: number) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-yellow-400" />
                  {action}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-medium">Long-term Strategy</h4>
            <ul className="space-y-2">
              {(riskAssessment.mitigation?.longTerm || []).map((strategy: any, index: number) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" />
                  {strategy}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Competitive Intelligence Display Component
 */
const CompetitiveIntelligenceDisplay: React.FC<{
  competitive: ForwardIntelligence["competitiveIntelligence"];
}> = ({ competitive }) => {
  return (
    <div className="space-y-6">
      {/* Rankings */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="glass-card glass-depth-parent p-6">
          <h3 className="mb-4 font-semibold">Regional Ranking</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Current Position:</span>
              <span className="text-lg font-bold">#{competitive.regionRanking.current}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Projected Position:</span>
              <span
                className={`text-lg font-bold ${competitive.regionRanking.projected < competitive.regionRanking.current ? "text-green-400" : competitive.regionRanking.projected > competitive.regionRanking.current ? "text-red-400" : ""}`}
              >
                #{competitive.regionRanking.projected}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Percentile:</span>
              <span className="font-medium">{competitive.regionRanking.percentile}th</span>
            </div>
          </div>
        </div>

        <div className="glass-card glass-depth-parent p-6">
          <h3 className="mb-4 font-semibold">Global Ranking</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Current Position:</span>
              <span className="text-lg font-bold">#{competitive.globalRanking.current}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Projected Position:</span>
              <span
                className={`text-lg font-bold ${competitive.globalRanking.projected < competitive.globalRanking.current ? "text-green-400" : competitive.globalRanking.projected > competitive.globalRanking.current ? "text-red-400" : ""}`}
              >
                #{competitive.globalRanking.projected}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Percentile:</span>
              <span className="font-medium">{competitive.globalRanking.percentile}th</span>
            </div>
          </div>
        </div>
      </div>

      {/* Benchmarks */}
      <div className="glass-card glass-depth-parent p-6">
        <h3 className="mb-4 font-semibold">Performance Benchmarks</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Object.entries(competitive.benchmarkComparisons || {}).map(
            ([metric, values]: [string, any]) => (
              <div key={metric} className="space-y-3">
                <h4 className="font-medium capitalize">
                  {metric.replace(/([A-Z])/g, " $1").trim()}
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Country:</span>
                    <span className="font-medium">
                      {formatBenchmarkValue(values.country, metric)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Regional Avg:</span>
                    <span className="text-muted-foreground">
                      {formatBenchmarkValue(values.regional, metric)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Global Avg:</span>
                    <span className="text-muted-foreground">
                      {formatBenchmarkValue(values.global, metric)}
                    </span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Advantages & Vulnerabilities */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="glass-card glass-depth-child p-4">
          <h4 className="mb-3 font-medium text-green-400">Competitive Advantages</h4>
          <ul className="space-y-2">
            {(competitive.competitiveAdvantages || []).map((advantage: any, index: number) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                {advantage}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card glass-depth-child p-4">
          <h4 className="mb-3 font-medium text-yellow-400">Vulnerabilities</h4>
          <ul className="space-y-2">
            {(competitive.vulnerabilities || []).map((vulnerability: any, index: number) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
                {vulnerability}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Strategic Recommendations */}
      <div className="glass-card glass-depth-parent p-6">
        <h3 className="mb-4 font-semibold">Strategic Recommendations</h3>
        <ul className="space-y-3">
          {(competitive.strategicRecommendations || []).map(
            (recommendation: any, index: number) => (
              <li key={index} className="flex items-start gap-3">
                <span className="bg-accent text-accent-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                  {index + 1}
                </span>
                <span className="text-sm">{recommendation}</span>
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  );
};

/**
 * Milestone Timeline Component
 */
const MilestoneTimeline: FC<MilestoneTimelineProps> = ({ milestones }) => {
  const allMilestones = [
    ...(milestones.economicMilestones || []).map((m: any) => ({ ...m, category: "economic" })),
    ...(milestones.populationMilestones || []).map((m: any) => ({ ...m, category: "population" })),
    ...(milestones.tierProgressions?.timeline || []).map((m: any) => ({
      ...m,
      category: "tier",
      type: "Tier Progression",
      description: m.milestone,
      estimatedDate: m.date,
      confidence: milestones.tierProgressions.confidence || 0.5,
      prerequisites: [],
    })),
  ].sort((a, b) => a.estimatedDate - b.estimatedDate);

  return (
    <div className="space-y-6">
      {/* Tier Progression Summary */}
      {milestones.tierProgressions.nextTier && (
        <div className="glass-card glass-depth-parent p-6">
          <h3 className="mb-4 font-semibold">Next Tier Progression</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-accent text-2xl font-bold">
                Tier {milestones.tierProgressions.nextTier}
              </div>
              <div className="text-muted-foreground text-sm">Target tier</div>
            </div>
            <div>
              <div className="text-lg font-medium">
                {formatDate(milestones.tierProgressions.estimatedDate)}
              </div>
              <div className="text-muted-foreground text-sm">Estimated date</div>
            </div>
            <div>
              <div className="text-lg font-medium">
                {Math.round(milestones.tierProgressions.confidence * 100)}%
              </div>
              <div className="text-muted-foreground text-sm">Confidence</div>
            </div>
          </div>

          {milestones.tierProgressions.requirements.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 font-medium">Requirements:</h4>
              <ul className="space-y-1">
                {(milestones.tierProgressions?.requirements || []).map(
                  (req: any, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="bg-accent mt-2 h-2 w-2 flex-shrink-0 rounded-full" />
                      {req}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="glass-card glass-depth-parent p-6">
        <h3 className="mb-6 font-semibold">Milestone Timeline</h3>

        {allMilestones.length > 0 ? (
          <div className="space-y-6">
            {allMilestones.map((milestone, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div
                    className={`h-3 w-3 rounded-full ${getMilestoneCategoryColor(milestone.category)} mt-1`}
                  />
                  {index < allMilestones.length - 1 && (
                    <div className="bg-border mt-2 ml-1 h-12 w-px" />
                  )}
                </div>

                <div className="flex-grow">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{milestone.description}</h4>
                      <div className="text-muted-foreground text-sm capitalize">
                        {milestone.category} • {milestone.type}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {formatDate(milestone.estimatedDate)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {Math.round((milestone.confidence || 0) * 100)}% confident
                      </div>
                    </div>
                  </div>

                  {milestone.prerequisites && milestone.prerequisites.length > 0 && (
                    <div className="text-muted-foreground text-sm">
                      <span className="font-medium">Prerequisites:</span>{" "}
                      {milestone.prerequisites.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            No milestones projected with current data
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Actionable Insights Component
 */
const ActionableInsights: React.FC<ActionableInsightsProps> = ({ insights }) => {
  const priorityColors = {
    critical: "border-red-500 bg-red-500/10",
    high: "border-orange-500 bg-orange-500/10",
    medium: "border-yellow-500 bg-yellow-500/10",
    low: "border-blue-500 bg-blue-500/10",
  };

  return (
    <div className="space-y-4">
      {insights.length > 0 ? (
        insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`glass-card glass-depth-child border-l-4 p-4 ${priorityColors[insight.priority as keyof typeof priorityColors] || priorityColors.medium}`}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`rounded px-2 py-1 text-xs font-medium ${getPriorityStyle(insight.priority)}`}
                >
                  {insight.priority}
                </div>
                <div className="text-muted-foreground text-sm">{insight.category}</div>
              </div>
              <div className="text-muted-foreground text-xs">{insight.timeframe}</div>
            </div>

            <div className="space-y-2">
              <p className="font-medium">{insight.insight}</p>
              <p className="text-muted-foreground text-sm">
                <span className="font-medium">Recommendation:</span> {insight.recommendation}
              </p>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="text-muted-foreground py-8 text-center">
          No actionable insights generated with current data
        </div>
      )}
    </div>
  );
};

// Loading, Error, and Empty State Components

const ForwardIntelligenceLoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-6">
    <div className="flex items-center gap-4">
      <div className="bg-muted h-8 w-32 rounded" />
      <div className="bg-muted/60 h-6 w-24 rounded" />
    </div>
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-muted h-10 w-24 rounded-lg" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="bg-muted h-64 rounded-lg" />
      <div className="bg-muted h-64 rounded-lg" />
    </div>
  </div>
);

const ForwardIntelligenceError: React.FC<{ error: string; onRetry: () => void }> = ({
  error,
  onRetry,
}) => (
  <div className="glass-card glass-depth-parent p-8 text-center">
    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
    <h3 className="mb-2 font-semibold">Forward Intelligence Generation Failed</h3>
    <p className="text-muted-foreground mb-4">{error}</p>
    <button
      onClick={onRetry}
      className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 transition-colors"
    >
      Retry Generation
    </button>
  </div>
);

const ForwardIntelligenceEmptyState: React.FC<{ countryId: string }> = ({ countryId }) => (
  <div className="glass-card glass-depth-parent p-8 text-center">
    <Brain className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
    <h3 className="mb-2 font-semibold">No Forward Intelligence Available</h3>
    <p className="text-muted-foreground">
      Insufficient data available for country {countryId} to generate forward-looking intelligence.
    </p>
  </div>
);

// Utility Functions

function generateMockHistoricalData(country: any) {
  // Generate mock historical data points for demonstration
  const data = [];
  const now = Date.now();
  const baseGdp = country.economicData?.[0]?.totalGdp || 1000000000;
  const basePop = country.populationData?.[0]?.totalPopulation || 1000000;

  for (let i = 30; i >= 0; i--) {
    const timestamp = now - i * 24 * 60 * 60 * 1000;
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation

    data.push({
      timestamp,
      totalGdp: baseGdp * (1 + variation * i * 0.01),
      gdpPerCapita:
        (baseGdp * (1 + variation * i * 0.01)) / (basePop * (1 + variation * i * 0.005)),
      totalPopulation: Math.round(basePop * (1 + variation * i * 0.005)),
      economicTier: country.economicTier || 1,
      populationTier: country.populationTier || 1,
      vitalityScore: 50 + variation * 20,
    });
  }

  return data;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function formatBenchmarkValue(value: number, metric: string): string {
  if (metric === "efficiency") return `$${formatLargeNumber(value)}`;
  if (metric.includes("Growth") || metric === "innovation") return `${value}%`;
  return formatLargeNumber(value);
}

function getDataQualityStyle(quality: string): string {
  const styles = {
    excellent: "bg-green-500/20 text-green-200 border border-green-300/30",
    good: "bg-blue-500/20 text-blue-200 border border-blue-300/30",
    fair: "bg-yellow-500/20 text-yellow-200 border border-yellow-300/30",
    limited: "bg-red-500/20 text-red-200 border border-red-300/30",
  };
  return styles[quality as keyof typeof styles] || styles.limited;
}

function getRiskColor(risk: string): string {
  const colors = {
    low: "text-green-400",
    medium: "text-yellow-400",
    high: "text-orange-400",
    critical: "text-red-400",
  };
  return colors[risk as keyof typeof colors] || colors.medium;
}

function getRiskBadgeStyle(risk: string): string {
  const styles = {
    low: "bg-green-500/20 text-green-200",
    medium: "bg-yellow-500/20 text-yellow-200",
    high: "bg-orange-500/20 text-orange-200",
    critical: "bg-red-500/20 text-red-200",
  };
  return styles[risk as keyof typeof styles] || styles.medium;
}

function getRiskLevelStyle(level: string): string {
  const styles = {
    low: "bg-green-500/20 text-green-200",
    medium: "bg-yellow-500/20 text-yellow-200",
    high: "bg-red-500/20 text-red-200",
  };
  return styles[level as keyof typeof styles] || styles.medium;
}

function getPriorityStyle(priority: string): string {
  const styles = {
    immediate: "bg-red-500/20 text-red-200",
    urgent: "bg-orange-500/20 text-orange-200",
    moderate: "bg-yellow-500/20 text-yellow-200",
    low: "bg-blue-500/20 text-blue-200",
    critical: "bg-red-500/20 text-red-200",
    high: "bg-orange-500/20 text-orange-200",
    medium: "bg-yellow-500/20 text-yellow-200",
  };
  return styles[priority as keyof typeof styles] || styles.medium;
}

function getMilestoneCategoryColor(category: string): string {
  const colors = {
    economic: "bg-green-400",
    population: "bg-blue-400",
    tier: "bg-purple-400",
  };
  return colors[category as keyof typeof colors] || "bg-gray-400";
}

// Performance tracking
ForwardLookingIntelligence.displayName = "ForwardLookingIntelligence";

export default ForwardLookingIntelligence;
