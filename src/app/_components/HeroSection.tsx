import React from "react";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Badge } from "~/components/ui/badge";
import { AnimatedNumber } from "~/components/ui/animated-number";
import { TrendIndicator } from "~/components/ui/trend-indicator";

interface HeroSectionProps {
  systemStatus: {
    status: 'operational' | 'maintenance' | 'degraded';
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
    <section className="hero-section relative min-h-[60vh] flex items-center">
      {/* Animated background */}
      <div className="aurora-bg absolute inset-0 opacity-30" />
      <div className="relative z-10 container mx-auto px-4">
        <GlassCard 
          variant="diplomatic" 
          glow="hover"
          className="hero-card overflow-hidden"
        >
          <div className="hero-content p-8 lg:p-12">
            {/* System Header */}
            <div className="flex items-center justify-between mb-8 flex-wrap gap-6">
              <div className="nation-header flex items-center gap-6">
                <div className="medallion-container">
                  <img 
                    src="/ixstats-emblem.png" 
                    alt="IxStats System Emblem"
                    className="w-20 h-20 lg:w-24 lg:h-24 medallion-glow"
                  />
                </div>
                <div className="nation-title-section">
                  <h1 className="nation-title text-3xl lg:text-4xl xl:text-5xl font-bold text-[var(--color-text-primary)]">
                    IxStats Command Center
                  </h1>
                  <p className="nation-subtitle text-lg text-[var(--color-text-secondary)] mt-2">
                    Global Nation Management System
                  </p>
                  <div className="nation-meta flex flex-wrap gap-3 mt-4">
                    <Badge 
                      variant={systemStatus.status === 'operational' ? 'default' : 'destructive'}
                      className="glass-badge"
                    >
                      {systemStatus.status === 'operational' ? '🟢' : '🟡'} System {systemStatus.status}
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
            <div className="global-stats grid grid-cols-2 lg:grid-cols-4 gap-4">
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
  prefix = '', 
  suffix = '', 
  decimals = 0, 
  trend 
}: {
  icon: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="stat-display text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-lg lg:text-xl font-bold text-[var(--color-text-primary)]">
        <AnimatedNumber 
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          duration={1500}
        />
      </div>
      <div className="text-sm text-[var(--color-text-secondary)] flex items-center justify-center gap-1">
        <span>{label}</span>
        <TrendIndicator trend={trend} />
      </div>
    </div>
  );
} 