"use client";

import React from "react";
import { motion } from "motion/react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  X,
  AlertCircle,
  Shield,
  Heart,
  GraduationCap,
  Leaf,
  Train,
  Home,
  Zap,
  Building,
  Coins,
  Users,
  Globe,
} from "lucide-react";
import { staggerContainer, staggerItem } from "./TabMotionConfig";

export interface PolicyBadge {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  icon?: LucideIcon;
  category?: "social" | "economic" | "environmental" | "infrastructure";
}

export interface PolicyBadgeGridProps {
  policies: PolicyBadge[];
  title?: string;
  subtitle?: string;
  showCategories?: boolean;
  compact?: boolean;
  animate?: boolean;
  className?: string;
}

// Default policy configurations
export const defaultPolicies: Omit<PolicyBadge, "enabled">[] = [
  {
    id: "universal-healthcare",
    key: "universalHealthcare",
    label: "Universal Healthcare",
    description: "Nationwide public health coverage",
    icon: Heart,
    category: "social",
  },
  {
    id: "free-education",
    key: "freeEducation",
    label: "Free Education",
    description: "Tuition-free education for citizens",
    icon: GraduationCap,
    category: "social",
  },
  {
    id: "renewable-energy",
    key: "renewableEnergyTransition",
    label: "Renewable Energy",
    description: "National transition toward clean energy",
    icon: Leaf,
    category: "environmental",
  },
  {
    id: "public-transport",
    key: "publicTransportExpansion",
    label: "Transit Expansion",
    description: "Major investments in public transport",
    icon: Train,
    category: "infrastructure",
  },
  {
    id: "disaster-prep",
    key: "disasterPreparedness",
    label: "Disaster Preparedness",
    description: "Coordinated response & resilience planning",
    icon: Shield,
    category: "infrastructure",
  },
  {
    id: "infra-bank",
    key: "infrastructureBankFund",
    label: "Infrastructure Bank",
    description: "Dedicated infrastructure innovation fund",
    icon: Building,
    category: "economic",
  },
  {
    id: "carbon-neutral",
    key: "carbonNeutrality",
    label: "Carbon Neutrality",
    description: "Long-term commitment to net-zero emissions",
    icon: Zap,
    category: "environmental",
  },
  {
    id: "affordable-housing",
    key: "affordableHousing",
    label: "Affordable Housing",
    description: "Public housing and affordability programs",
    icon: Home,
    category: "social",
  },
];

// Category colors and icons
const categoryConfig = {
  social: {
    color: "from-pink-500 to-rose-500",
    bgColor: "bg-pink-50 dark:bg-pink-900/20",
    borderColor: "border-pink-200 dark:border-pink-800",
    textColor: "text-pink-600 dark:text-pink-400",
    icon: Users,
    label: "Social",
  },
  economic: {
    color: "from-emerald-500 to-green-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    textColor: "text-emerald-600 dark:text-emerald-400",
    icon: Coins,
    label: "Economic",
  },
  environmental: {
    color: "from-cyan-500 to-teal-500",
    bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    borderColor: "border-cyan-200 dark:border-cyan-800",
    textColor: "text-cyan-600 dark:text-cyan-400",
    icon: Globe,
    label: "Environmental",
  },
  infrastructure: {
    color: "from-violet-500 to-purple-500",
    bgColor: "bg-violet-50 dark:bg-violet-900/20",
    borderColor: "border-violet-200 dark:border-violet-800",
    textColor: "text-violet-600 dark:text-violet-400",
    icon: Building,
    label: "Infrastructure",
  },
};

/**
 * PolicyBadgeGrid - Displays active policies with visual badges
 */
export function PolicyBadgeGrid({
  policies,
  title,
  subtitle,
  showCategories = true,
  compact = false,
  animate = true,
  className = "",
}: PolicyBadgeGridProps) {
  const enabledPolicies = policies.filter((p) => p.enabled);
  const disabledPolicies = policies.filter((p) => !p.enabled);

  const Wrapper = animate ? motion.div : "div";
  const ItemWrapper = animate ? motion.div : "div";

  const wrapperProps = animate
    ? {
        variants: staggerContainer,
        initial: "hidden",
        animate: "show",
      }
    : {};

  const itemProps = animate ? { variants: staggerItem } : {};

  // Group policies by category
  const groupedPolicies = showCategories
    ? Object.entries(
        enabledPolicies.reduce(
          (acc, policy) => {
            const cat = policy.category || "social";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(policy);
            return acc;
          },
          {} as Record<string, PolicyBadge[]>
        )
      )
    : null;

  const PolicyBadgeItem = ({ policy }: { policy: PolicyBadge }) => {
    const IconComponent = policy.icon || Check;
    const catConfig = policy.category ? categoryConfig[policy.category] : categoryConfig.social;

    if (compact) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={policy.enabled ? "default" : "outline"}
              className={cn(
                "cursor-help transition-all hover:scale-105",
                policy.enabled
                  ? cn("bg-gradient-to-r", catConfig.color, "text-white border-0")
                  : "opacity-50"
              )}
            >
              <IconComponent className="h-3 w-3 mr-1" />
              {policy.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{policy.label}</p>
            <p className="text-xs text-muted-foreground">{policy.description}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-all",
          policy.enabled
            ? cn(catConfig.bgColor, catConfig.borderColor, "hover:scale-[1.02]")
            : "bg-muted/30 border-muted opacity-60"
        )}
      >
        <div
          className={cn(
            "p-2 rounded-lg",
            policy.enabled
              ? cn("bg-gradient-to-br", catConfig.color)
              : "bg-muted"
          )}
        >
          <IconComponent
            className={cn(
              "h-4 w-4",
              policy.enabled ? "text-white" : "text-muted-foreground"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", policy.enabled && catConfig.textColor)}>
            {policy.label}
          </p>
          <p className="text-xs text-muted-foreground truncate">{policy.description}</p>
        </div>
        {policy.enabled ? (
          <Check className={cn("h-4 w-4 flex-shrink-0", catConfig.textColor)} />
        ) : (
          <X className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
      </div>
    );
  };

  return (
    <Card className={cn("glass-hierarchy-child", className)}>
      {(title || subtitle) && (
        <CardHeader className="pb-2">
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        {compact ? (
          <Wrapper className="flex flex-wrap gap-2" {...wrapperProps}>
            {policies.map((policy) => (
              <ItemWrapper key={policy.id} {...itemProps}>
                <PolicyBadgeItem policy={policy} />
              </ItemWrapper>
            ))}
          </Wrapper>
        ) : showCategories && groupedPolicies ? (
          <div className="space-y-4">
            {groupedPolicies.map(([category, categoryPolicies]) => {
              const catConfig = categoryConfig[category as keyof typeof categoryConfig];
              const CatIcon = catConfig.icon;
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <CatIcon className={cn("h-4 w-4", catConfig.textColor)} />
                    <span className={cn("text-sm font-semibold", catConfig.textColor)}>
                      {catConfig.label}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {categoryPolicies.length}
                    </Badge>
                  </div>
                  <Wrapper
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    {...wrapperProps}
                  >
                    {categoryPolicies.map((policy) => (
                      <ItemWrapper key={policy.id} {...itemProps}>
                        <PolicyBadgeItem policy={policy} />
                      </ItemWrapper>
                    ))}
                  </Wrapper>
                </div>
              );
            })}
            
            {disabledPolicies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">
                    Not Implemented
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {disabledPolicies.length}
                  </Badge>
                </div>
                <Wrapper
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  {...wrapperProps}
                >
                  {disabledPolicies.map((policy) => (
                    <ItemWrapper key={policy.id} {...itemProps}>
                      <PolicyBadgeItem policy={policy} />
                    </ItemWrapper>
                  ))}
                </Wrapper>
              </div>
            )}
          </div>
        ) : (
          <Wrapper
            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            {...wrapperProps}
          >
            {policies.map((policy) => (
              <ItemWrapper key={policy.id} {...itemProps}>
                <PolicyBadgeItem policy={policy} />
              </ItemWrapper>
            ))}
          </Wrapper>
        )}

        {/* Summary stats */}
        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {enabledPolicies.length} of {policies.length} policies active
          </span>
          <div className="flex items-center gap-1">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"
                initial={animate ? { width: 0 } : undefined}
                animate={{ width: `${(enabledPolicies.length / policies.length) * 100}%` }}
                transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
              />
            </div>
            <span className="font-medium">
              {Math.round((enabledPolicies.length / policies.length) * 100)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Helper function to create policy badges from spending data
 */
export function createPoliciesFromSpending(spendingData: Record<string, boolean | unknown>): PolicyBadge[] {
  return defaultPolicies.map((policy) => ({
    ...policy,
    enabled: Boolean(spendingData[policy.key]),
  }));
}
