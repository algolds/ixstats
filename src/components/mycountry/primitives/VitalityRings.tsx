"use client";

import { Activity, DollarSign, Users, Shield, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { HealthRing } from "~/components/ui/health-ring";

interface VitalityRingData {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
}

interface VitalityRingsProps {
  data: VitalityRingData;
  variant?: "sidebar" | "horizontal" | "grid";
  collapsed?: boolean;
}

const RING_CONFIG = [
  {
    key: "economicVitality" as keyof VitalityRingData,
    label: "Economic Health",
    subtitle: "GDP & Growth",
    color: "#22c55e",
    icon: DollarSign,
  },
  {
    key: "populationWellbeing" as keyof VitalityRingData,
    label: "Population Wellbeing",
    subtitle: "Demographics",
    color: "#3b82f6",
    icon: Users,
  },
  {
    key: "diplomaticStanding" as keyof VitalityRingData,
    label: "Diplomatic Standing",
    subtitle: "International",
    color: "#a855f7",
    icon: Shield,
  },
  {
    key: "governmentalEfficiency" as keyof VitalityRingData,
    label: "Government Efficiency",
    subtitle: "Administration",
    color: "#f97316",
    icon: Building,
  },
];

export function VitalityRings({
  data,
  variant = "sidebar",
  collapsed = false,
}: VitalityRingsProps) {
  if (collapsed && variant === "sidebar") {
    return null; // Handle collapsed state in parent
  }

  const renderRing = (config: (typeof RING_CONFIG)[0], index: number) => {
    const value = data[config.key] || 0;

    if (variant === "sidebar") {
      return (
        <div
          key={index}
          className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 bg-white/30 p-3 backdrop-blur-sm transition-all duration-300 hover:scale-102 dark:border-slate-700/50 dark:bg-slate-800/30"
        >
          <HealthRing
            value={Number(value)}
            size={48}
            color={config.color}
            className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            label={config.label}
            tooltip={`${config.label}: ${value.toFixed(1)}% performance - ${config.subtitle}`}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <config.icon className="h-3 w-3" style={{ color: config.color }} />
              <span className="text-xs font-medium">{config.label}</span>
            </div>
            <div className="text-muted-foreground text-xs">{config.subtitle}</div>
            <div className="text-sm font-bold" style={{ color: config.color }}>
              {value.toFixed(1)}%
            </div>
          </div>
        </div>
      );
    }

    if (variant === "horizontal") {
      return (
        <div key={index} className="flex items-center gap-4">
          <HealthRing
            value={Number(value)}
            size={80}
            color={config.color}
            className="flex-shrink-0"
            label={config.label}
            tooltip={`${config.label}: ${value.toFixed(1)}% performance - ${config.subtitle}`}
          />
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <config.icon className="h-4 w-4" style={{ color: config.color }} />
              <span className="font-medium">{config.label}</span>
            </div>
            <div className="text-muted-foreground text-sm">{value.toFixed(1)}% performance</div>
          </div>
        </div>
      );
    }

    // Grid variant
    return (
      <div key={index} className="flex flex-col items-center gap-3 text-center">
        <HealthRing
          value={Number(value)}
          size={80}
          color={config.color}
          className="flex-shrink-0"
          label={config.label}
          tooltip={`${config.label}: ${value.toFixed(1)}% performance - ${config.subtitle}`}
        />
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <config.icon className="h-4 w-4" style={{ color: config.color }} />
            <span className="text-sm font-medium">{config.label}</span>
          </div>
          <div className="text-muted-foreground text-xs">{value.toFixed(1)}% performance</div>
        </div>
      </div>
    );
  };

  if (variant === "sidebar") {
    return <div className="space-y-4">{RING_CONFIG.map(renderRing)}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <CardTitle>National Vitality</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            LIVE DATA
          </Badge>
        </div>
        <CardDescription>
          Real-time assessment of key national performance indicators
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={
            variant === "horizontal" ? "space-y-6" : "grid grid-cols-2 gap-6 lg:grid-cols-4"
          }
        >
          {RING_CONFIG.map(renderRing)}
        </div>
      </CardContent>
    </Card>
  );
}
