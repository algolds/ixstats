"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Globe,
  StatUp as TrendingUp,
  LightBulb as Lightbulb,
  Group as Users,
  City as Building2,
  CheckCircle,
  WarningTriangle as AlertTriangle,
  InfoCircle as Info,
  ArrowRight,
  Refresh as RefreshCw,
  Coins,
} from "iconoir-react";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";

interface ArchetypeDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  archetype: EconomicArchetype | null;
  isGloballySelected: boolean;
  isLoading: boolean;
  onApply: (archetype: EconomicArchetype) => void;
}

/** An inset group inside the sheet: an icon + title header over its content. */
function DetailSection({
  icon,
  title,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-surface-secondary rounded-row space-y-3 p-4 ${className ?? ""}`}>
      <h3 className="text-headline text-label flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetricBar({ label, display, value }: { label: string; display: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-callout text-label-secondary">{label}</span>
        <span className="text-headline text-label tabular-nums">{display}</span>
      </div>
      <Progress value={value} aria-label={label} />
    </div>
  );
}

function componentLabel(comp: unknown): string {
  if (typeof comp === "string") return comp.replace(/_/g, " ");
  const c = comp as { name?: string; componentType?: string } | null;
  return c?.name || c?.componentType || "";
}

/** Economic archetype details: a detail view, so a Sheet (Facet 3 §7.3). */
export function ArchetypeDetailsModal({
  isOpen,
  onOpenChange,
  archetype,
  isGloballySelected,
  isLoading,
  onApply,
}: ArchetypeDetailsModalProps) {
  if (!archetype) return null;

  const icon = (Icon: React.ComponentType<{ className?: string }>, color: string) => (
    <Icon aria-hidden className={`size-4 shrink-0 ${color}`} />
  );

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader className="border-separator shrink-0 border-b px-6 py-4 pr-14">
          <SheetTitle>{archetype.name} Preset Details</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Globe aria-hidden className="size-4 shrink-0" />
            {archetype.region}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-body text-label-secondary max-w-prose">{archetype.description}</p>
            <Button
              onClick={() => onApply(archetype)}
              disabled={isLoading || isGloballySelected}
              variant={isGloballySelected ? "tinted" : "filled"}
              size="lg"
              className="w-full shrink-0 sm:w-auto"
            >
              {isLoading ? (
                <>
                  <RefreshCw aria-hidden className="animate-spin" />
                  <span>Applying Preset...</span>
                </>
              ) : isGloballySelected ? (
                <>
                  <CheckCircle aria-hidden />
                  <span>Preset Applied</span>
                </>
              ) : (
                <>
                  <ArrowRight aria-hidden />
                  <span>Apply Archetype Preset</span>
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailSection icon={icon(TrendingUp, "text-green")} title="Growth metrics">
              <MetricBar
                label="GDP Growth"
                display={`${archetype.growthMetrics.gdpGrowth}%`}
                value={archetype.growthMetrics.gdpGrowth * 10}
              />
              <MetricBar
                label="Innovation Index"
                display={`${archetype.growthMetrics.innovationIndex}`}
                value={archetype.growthMetrics.innovationIndex}
              />
              <MetricBar
                label="Competitiveness"
                display={`${archetype.growthMetrics.competitiveness}`}
                value={archetype.growthMetrics.competitiveness}
              />
              <MetricBar
                label="Stability"
                display={`${archetype.growthMetrics.stability}`}
                value={archetype.growthMetrics.stability}
              />
            </DetailSection>

            <DetailSection icon={icon(Users, "text-blue")} title="Employment profile">
              <MetricBar
                label="Unemployment Rate"
                display={`${archetype.employmentProfile.unemploymentRate}%`}
                value={100 - archetype.employmentProfile.unemploymentRate * 10}
              />
              <MetricBar
                label="Labor Participation"
                display={`${archetype.employmentProfile.laborParticipation}%`}
                value={archetype.employmentProfile.laborParticipation}
              />
              <MetricBar
                label="Wage Growth"
                display={`${archetype.employmentProfile.wageGrowth}%`}
                value={archetype.employmentProfile.wageGrowth * 20}
              />
            </DetailSection>

            <DetailSection
              icon={icon(Building2, "text-purple")}
              title="Tax profile"
              className="md:col-span-2"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricBar
                  label="Corporate Tax"
                  display={`${archetype.taxProfile.corporateRate}%`}
                  value={archetype.taxProfile.corporateRate * 2}
                />
                <MetricBar
                  label="Income Tax"
                  display={`${archetype.taxProfile.incomeRate}%`}
                  value={archetype.taxProfile.incomeRate * 1.5}
                />
                <MetricBar
                  label="Consumption Tax"
                  display={`${archetype.taxProfile.consumptionRate}%`}
                  value={archetype.taxProfile.consumptionRate * 3}
                />
                <MetricBar
                  label="Revenue Efficiency"
                  display={`${Math.round(archetype.taxProfile.revenueEfficiency * 100)}%`}
                  value={archetype.taxProfile.revenueEfficiency * 100}
                />
              </div>
            </DetailSection>

            <DetailSection icon={icon(Building2, "text-blue")} title="Government components">
              <div className="flex flex-wrap gap-2">
                {archetype.governmentComponents && archetype.governmentComponents.length > 0 ? (
                  archetype.governmentComponents.map((comp, idx) => (
                    <Badge key={`gov-comp-${idx}`} variant="info">
                      {componentLabel(comp)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-footnote text-label-secondary">
                    No default government components
                  </span>
                )}
              </div>
            </DetailSection>

            <DetailSection icon={icon(Coins, "text-green")} title="Economic components">
              <div className="flex flex-wrap gap-2">
                {archetype.economicComponents && archetype.economicComponents.length > 0 ? (
                  archetype.economicComponents.map((comp, idx) => (
                    <Badge key={`econ-comp-${idx}`} variant="success">
                      {componentLabel(comp)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-footnote text-label-secondary">
                    No default economic components
                  </span>
                )}
              </div>
            </DetailSection>

            <DetailSection icon={icon(CheckCircle, "text-green")} title="Key strengths">
              <ul className="space-y-2">
                {archetype.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle aria-hidden className="text-green mt-0.5 size-4 shrink-0" />
                    <span className="text-body text-label">{strength}</span>
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection icon={icon(AlertTriangle, "text-red")} title="Key challenges">
              <ul className="space-y-2">
                {archetype.challenges.map((challenge, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AlertTriangle aria-hidden className="text-red mt-0.5 size-4 shrink-0" />
                    <span className="text-body text-label">{challenge}</span>
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection
              icon={icon(Lightbulb, "text-yellow")}
              title="Implementation recommendations"
              className="md:col-span-2"
            >
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {archetype.recommendations.map((rec, index) => (
                  <li key={index} className="text-body text-label-secondary flex items-start gap-2">
                    <span aria-hidden className="text-tint shrink-0">
                      •
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection
              icon={icon(Info, "text-teal")}
              title="Historical context & real-world examples"
              className="md:col-span-2"
            >
              <p className="text-body text-label-secondary">{archetype.historicalContext}</p>
              <div className="border-separator space-y-2 border-t pt-3">
                <h4 className="text-subhead text-label">Modern country examples</h4>
                <div className="flex flex-wrap gap-2">
                  {archetype.modernExamples.map((example, index) => (
                    <Badge key={index} variant="neutral">
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>
            </DetailSection>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
