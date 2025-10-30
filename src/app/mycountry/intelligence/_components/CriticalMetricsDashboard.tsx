import { motion } from "framer-motion";
import { MetricCard } from "~/components/shared";
import { AlertTriangle, TrendingUp, Target, Activity } from "lucide-react";

interface CriticalMetrics {
  criticalCount: number;
  opportunityCount: number;
  actionableCount: number;
  avgVitality: number;
}

interface CriticalMetricsDashboardProps {
  metrics: CriticalMetrics;
}

export function CriticalMetricsDashboard({ metrics }: CriticalMetricsDashboardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <MetricCard
        title="Critical Issues"
        value={metrics.criticalCount}
        description="Require attention"
        icon={AlertTriangle}
        theme={{
          primary: "from-red-500 to-red-600",
          secondary: "from-red-500/10 to-red-600/10",
          accent: "rgb(239, 68, 68)",
          bg: "rgba(239, 68, 68, 0.05)",
        }}
      />

      <MetricCard
        title="Opportunities"
        value={metrics.opportunityCount}
        description="Growth potential"
        icon={TrendingUp}
        theme={{
          primary: "from-green-500 to-green-600",
          secondary: "from-green-500/10 to-green-600/10",
          accent: "rgb(34, 197, 94)",
          bg: "rgba(34, 197, 94, 0.05)",
        }}
      />

      <MetricCard
        title="Actionable Items"
        value={metrics.actionableCount}
        description="Strategic actions"
        icon={Target}
        theme={{
          primary: "from-blue-500 to-blue-600",
          secondary: "from-blue-500/10 to-blue-600/10",
          accent: "rgb(59, 130, 246)",
          bg: "rgba(59, 130, 246, 0.05)",
        }}
      />

      <MetricCard
        title="National Health"
        value={`${metrics.avgVitality}%`}
        description="Overall vitality"
        icon={Activity}
        theme={{
          primary: "from-purple-500 to-purple-600",
          secondary: "from-purple-500/10 to-purple-600/10",
          accent: "rgb(168, 85, 247)",
          bg: "rgba(168, 85, 247, 0.05)",
        }}
      />
    </motion.div>
  );
}
