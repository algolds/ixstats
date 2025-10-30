import React from "react";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { TrendIndicator } from "~/components/ui/trend-indicator";

interface HeroSectionProps {
  systemStatus: {
    status: "operational" | "maintenance" | "degraded";
    activePlayers: number;
    totalCountries: number;
    systemUptime: number;
    lastUpdate: Date;
    ixTimeMultiplier: number;
  };
  globalStats: {
    totalGDP: number;
    totalPopulation: number;
    averageGDPPerCapita: number;
    activeDiplomacy: number;
  };
}

export function HeroSection({ systemStatus, globalStats }: HeroSectionProps) {
  return (
    <section className="hero-section relative flex min-h-[60vh] items-center">
      {/* Animated background */}
      <div className="aurora-bg absolute inset-0 opacity-30" />
      <div className="relative z-10 container mx-auto px-4">
        <GlassCard variant="diplomatic" glow="hover" className="hero-card overflow-hidden">
          <div className="hero-content p-8 lg:p-12">
            {/* System Header */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
              <div className="nation-header flex items-center gap-6">
                <div className="medallion-container">
                  <img
                    src="/ixstats-emblem.png"
                    alt="IxStats System Emblem"
                    className="medallion-glow h-20 w-20 lg:h-24 lg:w-24"
                  />
                </div>
                <div className="nation-title-section">
                  <h1 className="nation-title text-3xl font-bold text-[var(--color-text-primary)] lg:text-4xl xl:text-5xl">
                    IxStats Command Center
                  </h1>
                  <p className="nation-subtitle mt-2 text-lg text-[var(--color-text-secondary)]">
                    Global Nation Management System
                  </p>
                  <div className="nation-meta mt-4 flex flex-wrap gap-3">
                    <Badge
                      variant={systemStatus.status === "operational" ? "default" : "destructive"}
                      className="glass-badge"
                    >
                      {systemStatus.status === "operational" ? "🟢" : "🟡"} System{" "}
                      {systemStatus.status}
                    </Badge>
                    <Badge variant="outline" className="glass-badge">
                      🌍 {systemStatus.totalCountries} Nations
                    </Badge>
                    <Badge variant="outline" className="glass-badge">
                      👥 {systemStatus.activePlayers} Active Players
                    </Badge>
                  </div>
                </div>
              </div>
              {/* Optionally, add IxTimeDisplay or system uptime here */}
            </div>
            {/* Global Statistics */}
            <div className="global-stats grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatDisplay
                icon="💰"
                label="Global GDP"
                value={globalStats.totalGDP}
                prefix="$"
                suffix="T"
                decimals={1}
                trend="up"
              />
              <StatDisplay
                icon="👥"
                label="Total Population"
                value={globalStats.totalPopulation}
                suffix="B"
                decimals={2}
                trend="up"
              />
              <StatDisplay
                icon="📈"
                label="Avg GDP/Capita"
                value={globalStats.averageGDPPerCapita}
                prefix="$"
                suffix="K"
                decimals={1}
                trend="stable"
              />
              <StatDisplay
                icon="🤝"
                label="Active Diplomacy"
                value={globalStats.activeDiplomacy}
                trend="up"
              />
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

function StatDisplay({
  icon,
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  trend,
}: {
  icon: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend: "up" | "down" | "stable";
}) {
  return (
    <div className="stat-display text-center">
      <div className="mb-1 text-2xl">{icon}</div>
      <div className="text-lg font-bold text-[var(--color-text-primary)] lg:text-xl">
        <NumberFlowDisplay
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimalPlaces={decimals}
          duration={1500}
        />
      </div>
      <div className="flex items-center justify-center gap-1 text-sm text-[var(--color-text-secondary)]">
        <span>{label}</span>
        <TrendIndicator trend={trend} />
      </div>
    </div>
  );
}
