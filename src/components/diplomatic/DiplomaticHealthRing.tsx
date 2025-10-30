"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Globe, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface DiplomaticHealthRingProps {
  countryId: string;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

const RING_CONFIGS = {
  sm: {
    diameter: 80,
    strokeWidth: 6,
    gap: 3,
    centerSize: 32,
    iconSize: 16,
  },
  md: {
    diameter: 120,
    strokeWidth: 8,
    gap: 4,
    centerSize: 48,
    iconSize: 20,
  },
  lg: {
    diameter: 160,
    strokeWidth: 12,
    gap: 6,
    centerSize: 64,
    iconSize: 24,
  },
};

/**
 * Calculate diplomatic health score from various metrics
 */
function calculateDiplomaticHealth(data: {
  embassies: any[];
  relations: any[];
  missions: any[];
  exchanges: any[];
}) {
  const { embassies, relations, missions, exchanges } = data;

  // 1. Embassy Coverage Score (0-25 points)
  // Optimal number of embassies varies by country size, but 10-15 is reasonable
  const activeEmbassies = embassies.filter(
    (e: any) => e.status === "ACTIVE" || e.status === "active"
  );
  const embassyScore = Math.min(25, (activeEmbassies.length / 10) * 25);

  // 2. Relationship Strength Score (0-30 points)
  // Average relationship strength across all partners
  const avgRelationshipStrength =
    relations.length > 0
      ? relations.reduce((sum: number, r: any) => sum + (r.strength || 50), 0) / relations.length
      : 0;
  const relationshipScore = (avgRelationshipStrength / 100) * 30;

  // 3. Diplomatic Activity Score (0-25 points)
  // Recent missions completed, cultural exchanges, etc.
  const recentMissions = missions.filter((m: any) => {
    const completedDate = m.completedAt ? new Date(m.completedAt) : null;
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return completedDate && completedDate > monthAgo;
  });
  const recentExchanges = exchanges.filter(
    (e: any) => e.status === "active" || e.status === "ACTIVE"
  );
  const activityScore = Math.min(25, recentMissions.length * 3 + recentExchanges.length * 2);

  // 4. Mission Success Rate (0-20 points)
  const completedMissions = missions.filter(
    (m: any) => m.status === "completed" || m.status === "COMPLETED"
  );
  const successfulMissions = missions.filter(
    (m: any) =>
      (m.status === "completed" || m.status === "COMPLETED") && m.outcome?.success !== false
  );
  const successRate =
    completedMissions.length > 0 ? (successfulMissions.length / completedMissions.length) * 20 : 10; // Default score if no missions yet

  const totalScore = Math.round(embassyScore + relationshipScore + activityScore + successRate);

  return {
    score: Math.min(100, totalScore),
    breakdown: {
      embassyCoverage: Math.round(embassyScore),
      relationshipStrength: Math.round(relationshipScore),
      diplomaticActivity: Math.round(activityScore),
      missionSuccess: Math.round(successRate),
    },
    metrics: {
      activeEmbassies: activeEmbassies.length,
      totalRelations: relations.length,
      avgStrength: Math.round(avgRelationshipStrength),
      recentMissions: recentMissions.length,
      activeExchanges: recentExchanges.length,
      successRate:
        completedMissions.length > 0
          ? Math.round((successfulMissions.length / completedMissions.length) * 100)
          : 0,
    },
  };
}

export function DiplomaticHealthRing({
  countryId,
  size = "md",
  interactive = true,
  onClick,
  className = "",
}: DiplomaticHealthRingProps) {
  const config = RING_CONFIGS[size];

  // Fetch diplomatic data
  const { data: embassies = [] } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: relations = [] } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: exchanges = [] } = api.diplomatic.getCulturalExchanges.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Calculate health score
  const healthData = useMemo(() => {
    // Mock missions data (would come from API in production)
    const missions: any[] = [];

    return calculateDiplomaticHealth({
      embassies,
      relations,
      missions,
      exchanges,
    });
  }, [embassies, relations, exchanges]);

  const { score, breakdown, metrics } = healthData;

  // Determine trend based on score
  const trend = score >= 70 ? "up" : score >= 40 ? "stable" : "down";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Activity;

  // Color gradient based on score
  const color =
    score >= 80 ? "#7C3AED" : score >= 60 ? "#8B5CF6" : score >= 40 ? "#A78BFA" : "#C4B5FD";

  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference * (1 - score / 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className={`relative cursor-pointer ${interactive ? "hover:scale-105" : ""} ${className}`}
          style={{
            width: config.diameter,
            height: config.diameter,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
          }}
          onClick={onClick}
          whileHover={interactive ? { scale: 1.05 } : {}}
          whileTap={interactive ? { scale: 0.95 } : {}}
        >
          {/* Background Ring */}
          <svg
            className="absolute inset-0 -rotate-90 transform"
            width={config.diameter}
            height={config.diameter}
          >
            <circle
              cx={config.diameter / 2}
              cy={config.diameter / 2}
              r={radius}
              fill="none"
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth={config.strokeWidth}
              className="dark:stroke-white/10"
            />
          </svg>

          {/* Progress Ring */}
          <svg
            className="absolute inset-0 -rotate-90 transform"
            width={config.diameter}
            height={config.diameter}
          >
            <defs>
              <filter id="glow-diplomatic" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feGaussianBlur stdDeviation="12" result="coloredBlur2" />
                <feMerge>
                  <feMergeNode in="coloredBlur2" />
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="gradient-diplomatic" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="1" />
                <stop offset="40%" stopColor={color} stopOpacity="0.9" />
                <stop offset="70%" stopColor={color} stopOpacity="0.7" />
                <stop offset="100%" stopColor={color} stopOpacity="0.4" />
              </linearGradient>
            </defs>
            <motion.circle
              cx={config.diameter / 2}
              cy={config.diameter / 2}
              r={radius}
              fill="none"
              stroke="url(#gradient-diplomatic)"
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{
                duration: 2,
                ease: "easeInOut",
              }}
              style={{
                filter: "url(#glow-diplomatic)",
              }}
              className="glass-hierarchy-interactive"
            />
          </svg>

          {/* Center Content */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
            style={{
              width: config.centerSize,
              height: config.centerSize,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <Globe size={config.iconSize} className="mb-1" style={{ color }} />
            <motion.div
              className="text-lg font-bold"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              {score}
            </motion.div>
          </div>

          {/* Animated Glow Background */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${color}15 0%, transparent 60%)`,
              filter: "blur(8px)",
            }}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Pulse Effect for Low Scores */}
          {score < 40 && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${color}15 0%, transparent 60%)`,
                filter: "blur(4px)",
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </motion.div>
      </TooltipTrigger>

      <TooltipContent className="glass-hierarchy-child max-w-xs p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe size={16} style={{ color }} />
            <span className="font-semibold">Diplomatic Health</span>
            <Badge variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "destructive"}>
              {score >= 80
                ? "Excellent"
                : score >= 60
                  ? "Good"
                  : score >= 40
                    ? "Fair"
                    : "Needs Attention"}
            </Badge>
          </div>

          <p className="text-muted-foreground text-sm">
            Overall assessment of diplomatic operations, relationships, and international standing.
          </p>

          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-semibold">Score Breakdown:</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Embassy Coverage:</span>
                <span className="font-medium">{breakdown.embassyCoverage}/25</span>
              </div>
              <div className="flex justify-between">
                <span>Relationship Strength:</span>
                <span className="font-medium">{breakdown.relationshipStrength}/30</span>
              </div>
              <div className="flex justify-between">
                <span>Diplomatic Activity:</span>
                <span className="font-medium">{breakdown.diplomaticActivity}/25</span>
              </div>
              <div className="flex justify-between">
                <span>Mission Success:</span>
                <span className="font-medium">{breakdown.missionSuccess}/20</span>
              </div>
            </div>
          </div>

          <div className="border-border space-y-1 border-t pt-2">
            <div className="text-muted-foreground text-xs font-semibold">Key Metrics:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Active Embassies</div>
                <div className="font-medium">{metrics.activeEmbassies}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Relations</div>
                <div className="font-medium">{metrics.totalRelations}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Avg Strength</div>
                <div className="font-medium">{metrics.avgStrength}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Success Rate</div>
                <div className="font-medium">{metrics.successRate}%</div>
              </div>
            </div>
          </div>

          <div className="border-border border-t pt-2">
            <div className="flex items-center gap-2 text-xs">
              <TrendIcon
                className={`h-3 w-3 ${
                  trend === "up"
                    ? "text-green-600"
                    : trend === "down"
                      ? "text-red-600"
                      : "text-yellow-600"
                }`}
              />
              <span className="text-muted-foreground">
                {score >= 80
                  ? "Strong diplomatic position"
                  : score >= 60
                    ? "Stable diplomatic relations"
                    : score >= 40
                      ? "Room for improvement"
                      : "Critical - expand diplomatic efforts"}
              </span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default DiplomaticHealthRing;
