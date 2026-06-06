"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Lock,
  Star,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Globe,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { GlassButton } from "./glass-button";

interface PremiumGateProps {
  feature: "sdi" | "eci" | "intelligence" | "defense" | "analytics";
  title?: string;
  description?: string;
  className?: string;
  /** Optional overrides for the CTA buttons (default: navigate to in-app help). */
  onUpgrade?: () => void;
  onLearnMore?: () => void;
}

interface FeatureConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  color: string;
  iconColor: string;
  accentBar: string;
}

const featureConfig: Record<PremiumGateProps["feature"], FeatureConfig> = {
  sdi: {
    icon: Shield,
    title: "SDI Dashboard",
    description:
      "Access real-time crisis monitoring, diplomatic intelligence, and security analytics",
    features: [
      "Real-time crisis monitoring",
      "Diplomatic intelligence feeds",
      "Security threat assessment",
      "International economic indicators",
    ],
    color: "from-red-500/20 to-red-600/20",
    iconColor: "text-red-400",
    accentBar: "bg-red-500/40",
  },
  eci: {
    icon: TrendingUp,
    title: "ECI Command Center",
    description: "Executive control interface with AI-powered policy recommendations and analytics",
    features: [
      "AI policy recommendations",
      "Executive decision support",
      "Predictive economic modeling",
      "Strategic planning tools",
    ],
    color: "from-indigo-500/20 to-indigo-600/20",
    iconColor: "text-indigo-400",
    accentBar: "bg-indigo-500/40",
  },
  intelligence: {
    icon: Globe,
    title: "Intelligence Network",
    description:
      "Turn your nation's raw data into decisions: live briefings, trend analysis, and forecasts",
    features: [
      "Executive intelligence briefings",
      "Economic & diplomatic analytics",
      "Predictive forecasting models",
      "Secure communications channel",
    ],
    color: "from-blue-500/20 to-cyan-600/20",
    iconColor: "text-blue-400",
    accentBar: "bg-blue-500/40",
  },
  defense: {
    icon: Shield,
    title: "Defense & Security Command",
    description:
      "Full access to military operations, force management, and security infrastructure",
    features: [
      "Military force customization",
      "Active operations & deployments",
      "Defense budget allocation",
      "Security & stability monitoring",
    ],
    color: "from-red-500/20 to-orange-600/20",
    iconColor: "text-red-400",
    accentBar: "bg-red-500/40",
  },
  analytics: {
    icon: Zap,
    title: "Advanced Analytics",
    description: "Deep data insights and advanced visualization tools",
    features: [
      "Advanced data modeling",
      "Custom dashboards",
      "Export capabilities",
      "Historical trend analysis",
    ],
    color: "from-green-500/20 to-green-600/20",
    iconColor: "text-green-400",
    accentBar: "bg-green-500/40",
  },
};

/** A faux widget card used to build the blurred "preview" of the locked dashboard. */
function FauxCard({
  icon: Icon,
  label,
  iconColor,
  accentBar,
  variant,
}: {
  icon: LucideIcon;
  label: string;
  iconColor: string;
  accentBar: string;
  variant: "bars" | "chart" | "stat";
}) {
  return (
    <div className="border-border/40 bg-card/60 rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <span className="text-foreground/70 truncate text-[11px] font-medium">{label}</span>
      </div>
      {variant === "bars" && (
        <div className="space-y-1.5">
          <div className={`h-1.5 w-3/4 rounded-full ${accentBar}`} />
          <div className="bg-muted h-1.5 w-1/2 rounded-full" />
          <div className="bg-muted h-1.5 w-2/3 rounded-full" />
        </div>
      )}
      {variant === "chart" && (
        <div className="flex h-12 items-end gap-1">
          {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm ${accentBar}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
      {variant === "stat" && (
        <div className="space-y-1">
          <div className={`h-4 w-1/2 rounded ${accentBar}`} />
          <div className="bg-muted h-1.5 w-3/4 rounded-full" />
        </div>
      )}
    </div>
  );
}

export function PremiumGate({
  feature,
  title,
  description,
  className = "",
  onUpgrade,
  onLearnMore,
}: PremiumGateProps) {
  const router = useRouter();
  const config = featureConfig[feature];
  const Icon = config.icon;

  const variants: Array<"bars" | "chart" | "stat"> = ["stat", "chart", "bars", "chart", "stat", "bars"];

  const handleUpgrade = onUpgrade ?? (() => router.push("/help/getting-started/welcome"));
  const handleLearnMore = onLearnMore ?? (() => router.push("/help"));

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {/* Blurred "preview" of the locked dashboard (decorative) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
        <div className={`absolute inset-0 bg-gradient-to-br ${config.color}`} />
        <div className="grid grid-cols-2 gap-3 p-4 opacity-50 blur-[2px] sm:grid-cols-3">
          {config.features.concat(config.features).slice(0, 6).map((f, i) => (
            <FauxCard
              key={i}
              icon={Icon}
              label={f}
              iconColor={config.iconColor}
              accentBar={config.accentBar}
              variant={variants[i % variants.length]!}
            />
          ))}
        </div>
        {/* Fade the preview toward the center so the CTA stays legible */}
        <div className="from-card via-card/80 to-card/40 absolute inset-0 bg-gradient-to-t" />
      </div>

      {/* Foreground value proposition */}
      <div className="relative z-10 flex min-h-[460px] items-center justify-center p-6 sm:p-8">
        <div className="border-border/60 bg-card/80 max-w-lg space-y-5 rounded-2xl border p-6 text-center shadow-xl backdrop-blur-md sm:p-8">
          {/* Lock + crown */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="border-border bg-muted/60 flex h-14 w-14 items-center justify-center rounded-full border">
                <Lock className="text-muted-foreground h-7 w-7" />
              </div>
              <Crown className="absolute -top-1 -right-1 h-5 w-5 text-yellow-400" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Icon className={`h-6 w-6 ${config.iconColor}`} />
            <h2 className="text-xl font-bold sm:text-2xl">{title || config.title}</h2>
          </div>

          <p className="text-muted-foreground leading-relaxed">{description || config.description}</p>

          {/* Feature bullets */}
          <div className="mx-auto max-w-sm space-y-2 text-left">
            {config.features.map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <Star className="h-4 w-4 shrink-0 text-yellow-400" />
                <span className="text-foreground/90 text-sm">{f}</span>
              </div>
            ))}
          </div>

          {/* Premium badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-gradient-to-r from-yellow-500/15 to-orange-500/15 px-4 py-1.5">
            <Crown className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-200">
              MyCountry Premium
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <GlassButton variant="primary" className="group flex-1" onClick={handleUpgrade}>
              <Crown className="mr-2 h-4 w-4" />
              Upgrade to Premium
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </GlassButton>
            <GlassButton variant="secondary" className="flex-1" onClick={handleLearnMore}>
              <Users className="mr-2 h-4 w-4" />
              Learn More
            </GlassButton>
          </div>

          <p className="text-muted-foreground text-xs">Starting at $9.99/month · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

export default PremiumGate;
