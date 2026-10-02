"use client";

import { Activity, Dollar as DollarSign, Group as Users, Shield, Building } from "iconoir-react";
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
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
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
    color: "var(--color-green-500)",
    icon: DollarSign,
  },
  {
    key: "populationWellbeing" as keyof VitalityRingData,
    label: "Population Wellbeing",
    subtitle: "Demographics",
    color: "var(--color-blue-500)",
    icon: Users,
  },
  {
    key: "diplomaticStanding" as keyof VitalityRingData,
    label: "Diplomatic Standing",
    subtitle: "International",
    color: "var(--color-purple-500)",
    icon: Shield,
  },
  {
    key: "governmentalEfficiency" as keyof VitalityRingData,
    label: "Government Efficiency",
    subtitle: "Administration",
    color: "var(--color-orange-500)",
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
          className="hover:bg-fill-3 focus-visible:ring-tint rounded-control flex cursor-pointer items-center gap-3 p-3 transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]"
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
            className="shrink-0"
            label={ring.label}
            tooltip={tooltipText}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              {Icon && <Icon className="h-3 w-3" style={{ color: ring.color }} />}
              <span className="text-caption">{ring.label}</span>
            </div>
            <div className="text-label-secondary text-footnote">{ring.subtitle}</div>
            <div className="text-headline" style={{ color: ring.color }}>
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
            <div className="text-label-secondary text-body">{display}</div>
          </div>
        </div>
      );
    }

    // Grid variant — pronounced cards
    return (
      <div
        key={ring.key ?? index}
        className={`rounded-control flex items-center gap-3 p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ${isClickable ? "hover:ring-foreground/20 cursor-pointer hover:scale-[1.02] hover:ring-1" : ""}`}
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
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: ring.color }} />}
            <span className="text-caption truncate font-semibold">{ring.label}</span>
          </div>
          <div className="text-headline mt-0.5" style={{ color: ring.color }}>
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
    <Card className="flex flex-col gap-6 px-3 py-2 py-6">
      <div className="mb-2 flex items-center gap-1">
        <Activity className="text-blue h-3.5 w-3.5" />
        <span className="text-caption font-semibold">{title}</span>
        <Badge variant="outline" className="text-footnote ml-auto px-2 py-0">
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
