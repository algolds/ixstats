"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, DollarSign, Users, Shield, Building } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { HealthRing } from "~/components/ui/health-ring";

import { getAppleVitalityColor } from "./tabs/VitalityRingsDisplay";

export interface VitalityRingData {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
}

export interface RingConfig {
  key: string;
  label: string;
  subtitle: string;
  color: string;
  icon: LucideIcon;
  value: number;
  target?: number; // ring fill target (default 100)
  displayValue?: string; // custom text (e.g. "5 active", "72/100") — replaces auto "%"
  onClick?: () => void;
}

interface VitalityRingsProps {
  data?: VitalityRingData;
  rings?: RingConfig[];
  title?: string;
  variant?: "sidebar" | "horizontal" | "grid";
  collapsed?: boolean;
}

const DEFAULT_RING_CONFIG = [
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
  rings,
  title = "National Vitality",
  variant = "sidebar",
  collapsed = false,
}: VitalityRingsProps) {
  if (collapsed && variant === "sidebar") {
    return null;
  }

  // Build unified ring list: custom rings take priority, otherwise derive from data + defaults
  const resolvedRings: RingConfig[] = rings
    ? rings.map((r) => ({ ...r, color: r.color || getAppleVitalityColor(r.value || 0) }))
    : DEFAULT_RING_CONFIG.map((cfg) => {
        const val = data?.[cfg.key] || 0;
        return {
          ...cfg,
          value: val,
          color: getAppleVitalityColor(val),
        };
      });

  const renderRing = (ring: RingConfig, index: number) => {
    const value = ring.value || 0;
    const Icon = ring.icon;
    const isClickable = !!ring.onClick;
    const display = ring.displayValue ?? `${value.toFixed(1)}%`;
    const tooltipText = `${ring.label}: ${display} - ${ring.subtitle}`;

    if (variant === "sidebar") {
      return (
        <div
          key={ring.key ?? index}
          className="glass-hierarchy-child group flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-all duration-300 hover:scale-102"
          onClick={ring.onClick}
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={
            isClickable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") ring.onClick?.();
                }
              : undefined
          }
        >
          <HealthRing
            value={Number(value)}
            size={48}
            color={ring.color}
            target={ring.target}
            className="shrink-0 transition-transform duration-300 group-hover:scale-110"
            label={ring.label}
            tooltip={tooltipText}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              {Icon && <Icon className="h-3 w-3" style={{ color: ring.color }} />}
              <span className="text-xs font-medium">{ring.label}</span>
            </div>
            <div className="text-muted-foreground text-xs">{ring.subtitle}</div>
            <div className="text-sm font-bold" style={{ color: ring.color }}>
              {display}
            </div>
          </div>
        </div>
      );
    }

    if (variant === "horizontal") {
      return (
        <div
          key={ring.key ?? index}
          className={`flex items-center gap-4 ${isClickable ? "cursor-pointer" : ""}`}
          onClick={ring.onClick}
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={
            isClickable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") ring.onClick?.();
                }
              : undefined
          }
        >
          <HealthRing
            value={Number(value)}
            size={80}
            color={ring.color}
            target={ring.target}
            className="shrink-0"
            label={ring.label}
            tooltip={tooltipText}
          />
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4" style={{ color: ring.color }} />}
              <span className="font-medium">{ring.label}</span>
            </div>
            <div className="text-muted-foreground text-sm">{display}</div>
          </div>
        </div>
      );
    }

    // Grid variant — pronounced cards
    return (
      <div
        key={ring.key ?? index}
        className={`glass-hierarchy-child flex items-center gap-3 rounded-lg p-2.5 transition-all duration-200 ${isClickable ? "hover:ring-foreground/20 cursor-pointer hover:scale-[1.02] hover:ring-1" : ""}`}
        onClick={ring.onClick}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") ring.onClick?.();
              }
            : undefined
        }
      >
        <HealthRing
          value={Number(value)}
          size={44}
          color={ring.color}
          target={ring.target}
          className="shrink-0"
          label={ring.label}
          tooltip={tooltipText}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: ring.color }} />}
            <span className="truncate text-xs font-semibold">{ring.label}</span>
          </div>
          <div className="mt-0.5 text-sm font-bold" style={{ color: ring.color }}>
            {display}
          </div>
        </div>
      </div>
    );
  };

  if (variant === "sidebar") {
    return <div className="space-y-4">{resolvedRings.map(renderRing)}</div>;
  }

  return (
    <Card className="px-3 py-2">
      <div className="mb-1.5 flex items-center gap-1">
        <Activity className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-semibold">{title}</span>
        <Badge variant="outline" className="ml-auto px-1.5 py-0 text-[10px]">
          LIVE
        </Badge>
      </div>
      <div
        className={
          variant === "horizontal"
            ? "space-y-4"
            : `grid grid-cols-2 gap-3 ${resolvedRings.length <= 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`
        }
      >
        {resolvedRings.map(renderRing)}
      </div>
    </Card>
  );
}
