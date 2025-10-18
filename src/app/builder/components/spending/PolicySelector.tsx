// PolicySelector Component
// Refactored from GovernmentSpendingSectionEnhanced.tsx
// Handles policy selection interface with filtering and categorization

"use client";

import React from 'react';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import { CheckCircle2 } from 'lucide-react';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { getApplicablePolicies, type SpendingPolicy } from '../../data/government-spending-policies';
import { BlurFade } from '~/components/magicui/blur-fade';
import { ProgressiveBlur } from '~/components/ui/progressive-blur';

interface PolicySelectorProps {
  selectedPolicies: Set<string>;
  selectedAtomicComponents: ComponentType[];
  onTogglePolicy: (policyId: string) => void;
  className?: string;
}

/**
 * PolicySelector - Displays and manages policy selection
 * Filters policies based on atomic components and shows impact metrics
 */
export function PolicySelector({
  selectedPolicies,
  selectedAtomicComponents,
  onTogglePolicy,
  className
}: PolicySelectorProps) {
  const applicablePolicies = getApplicablePolicies(selectedAtomicComponents);
  const visibleCount = 3; // Show first 3 policies
  const visiblePolicies = applicablePolicies.slice(0, visibleCount);
  const hiddenPolicies = applicablePolicies.slice(visibleCount);

  if (applicablePolicies.length === 0) {
    return (
      <div className={cn("grid gap-3", className)}>
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No applicable policies found. Select atomic components to see recommended policies.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      {/* Show first 5 policies with progressive reveal if there are more */}
      {hiddenPolicies.length > 0 ? (
        <ProgressiveBlur
          blurIntensity={10}
          gradientHeight={150}
          arrowPosition="center"
          revealContent={
            <div className="grid gap-3">
              {hiddenPolicies.map((policy, index) => {
                const isSelected = selectedPolicies.has(policy.id);
                return (
                  <BlurFade
                    key={policy.id}
                    delay={index * 0.05}
                    duration={0.4}
                    offset={8}
                    direction="up"
                  >
                    <PolicyCard
                      policy={policy}
                      isSelected={isSelected}
                      onClick={() => onTogglePolicy(policy.id)}
                    />
                  </BlurFade>
                );
              })}
            </div>
          }
        >
          <div className="grid gap-3">
            {visiblePolicies.map((policy, index) => {
              const isSelected = selectedPolicies.has(policy.id);
              return (
                <BlurFade
                  key={policy.id}
                  delay={index * 0.08}
                  duration={0.5}
                  offset={10}
                  direction="up"
                  inView
                  inViewMargin="-50px"
                >
                  <PolicyCard
                    policy={policy}
                    isSelected={isSelected}
                    onClick={() => onTogglePolicy(policy.id)}
                  />
                </BlurFade>
              );
            })}
          </div>
        </ProgressiveBlur>
      ) : (
        // If 3 or fewer policies, just show them with blur-fade
        <>
          {applicablePolicies.map((policy, index) => {
            const isSelected = selectedPolicies.has(policy.id);
            return (
              <BlurFade
                key={policy.id}
                delay={index * 0.08}
                duration={0.5}
                offset={10}
                direction="up"
                inView
                inViewMargin="-50px"
              >
                <PolicyCard
                  policy={policy}
                  isSelected={isSelected}
                  onClick={() => onTogglePolicy(policy.id)}
                />
              </BlurFade>
            );
          })}
        </>
      )}
    </div>
  );
}

/**
 * PolicyCard - Individual policy display card
 */
function PolicyCard({
  policy,
  isSelected,
  onClick
}: {
  policy: SpendingPolicy;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = policy.icon;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all",
        isSelected && "ring-2 ring-blue-500"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "p-2 rounded-lg transition-colors",
                isSelected ? "bg-blue-500/10" : "bg-muted"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isSelected ? "text-blue-600" : "text-muted-foreground"
                )}
              />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium">{policy.name}</h4>
              <p className="text-xs text-muted-foreground">
                {policy.description}
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {Object.entries(policy.impact).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {value > 0 ? '+' : ''}{value}%
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-1">
            {isSelected ? (
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
