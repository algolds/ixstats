"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Archery as Target,
  KeyCommand as Command,
  OpenBook as BookOpen,
  ControlSlider as Sliders,
  Component as Layers,
  CornerBottomRight as CornerDownRight,
  Check,
  CheckCircle as CheckCircle2,
  ShareAndroid as Share2,
  Compass,
  Group as Users2,
  Globe as Globe2,
  Shield,
  Bank as Landmark,
  City as Building2,
  GitBranch,
  WarningTriangle as AlertTriangle,
  ArrowUpRight,
} from "iconoir-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { DOMAIN_META, type V2Domain } from "./domain-meta";
import { STATUS_TEXT } from "./status-tone";
import { HUE_PAINT, hueOf } from "./domain-hue";
import { ThinkPagesShareModal } from "~/components/mycountry/shared/modals/ThinkPagesShareModal";
import { IssueDetailBrief } from "~/components/mycountry/shared/headers/IssueDetailBrief";

const PoliticsDrillDown = dynamic(
  () => import("./PoliticsDrillDown").then((m) => ({ default: m.PoliticsDrillDown })),
  { loading: () => <Skeleton className="rounded-card h-64" />, ssr: false }
);

const EconomyDrillDown = dynamic(
  () => import("./EconomyDrillDown").then((m) => ({ default: m.EconomyDrillDown })),
  { loading: () => <Skeleton className="rounded-card h-64" />, ssr: false }
);

const EmbassiesAndRelationsPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/diplomacy/EmbassiesAndRelationsPanel").then((m) => ({
      default: m.EmbassiesAndRelationsPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

const DefenseCommandPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/DefenseCommandPanel").then((m) => ({
      default: m.DefenseCommandPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

/** A v2 drill-down surface. Phase 3 connects deep domain panels directly inside right-side sheets. */
export type DrillSheetKind =
  | { kind: "intent"; intentId: string }
  | { kind: "issue"; issueId: string }
  | { kind: "relations" }
  | { kind: "defense" }
  | { kind: "politics" }
  | { kind: "economy" }
  | null;

export type V2Drill = DrillSheetKind;

/** Directive tier → semantic text tone (measured is calm, extreme is a warning sign). */
const TIER_TONE: Record<string, string> = {
  measured: "text-green",
  moderate: STATUS_TEXT.warning,
  extreme: STATUS_TEXT.critical,
};

/** Directive status → semantic dot. */
function statusDot(status: string | null | undefined): string {
  return status === "completed"
    ? "bg-green"
    : status === "abandoned"
      ? "bg-destructive"
      : status === "active"
        ? "bg-yellow"
        : "bg-label-tertiary";
}

const CATEGORY_BROKER_MAP: Record<
  string,
  { name: string; icon: React.ComponentType<{ className?: string }> }
> = {
  defense: { name: "Generals", icon: Shield },
  security: { name: "Generals", icon: Shield },
  fiscal: { name: "Magnates", icon: Building2 },
  economy: { name: "Magnates", icon: Building2 },
  social: { name: "Party", icon: Users2 },
  infrastructure: { name: "Technocrats", icon: Compass },
  religion: { name: "Clergy", icon: Landmark },
  foreign: { name: "Cabinet Diplomatic Corps", icon: Globe2 },
};

/**
 * A section inside the drill sheet. The sheet is the only blurred surface, so every card in it
 * is opaque (`surface="solid"`).
 */
function SheetSection({
  title,
  icon: Icon,
  accessory,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accessory?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <FacetCard className={cn("rounded-card", className)}>
      <FacetCardHeader className="flex-row items-center justify-between gap-2 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* v2: section glyphs in the MyCountry gold */}
          <Icon aria-hidden="true" className="text-tint h-4 w-4 shrink-0" />
          <h3 className="text-label text-headline">{title}</h3>
        </div>
        {accessory}
      </FacetCardHeader>
      <FacetCardContent className="px-4 pb-4">{children}</FacetCardContent>
    </FacetCard>
  );
}

function IntentBranchingTree({
  countryId,
  currentIntentId,
}: {
  countryId: string;
  currentIntentId: string;
}) {
  const { data, isLoading } = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });

  if (isLoading || !data?.roots?.length) return null;

  return (
    <SheetSection title="Decision tree" icon={GitBranch}>
      <ul className="divide-separator divide-y">
        {data.allIntents.slice(0, 4).map((it) => {
          const isCurrent = it.id === currentIntentId;
          return (
            <li
              key={it.id}
              aria-current={isCurrent ? "true" : undefined}
              className="text-footnote flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-2 shrink-0 rounded-full", statusDot(it.status))}
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate",
                      isCurrent ? "text-label font-semibold" : "text-label font-medium"
                    )}
                  >
                    {it.goal}
                  </p>
                  <p className="text-label-secondary capitalize">
                    {it.category} · {it.tier}
                  </p>
                </div>
              </div>
              {isCurrent ? (
                <Badge variant="outline" className={cn("shrink-0", STATUS_TEXT.accent)}>
                  This directive
                </Badge>
              ) : (
                <span className="text-label-secondary shrink-0 capitalize">{it.status}</span>
              )}
            </li>
          );
        })}
      </ul>
    </SheetSection>
  );
}

function IntentDetail({
  countryId,
  intentId,
  onDeclare,
  onClose,
}: {
  countryId: string;
  intentId: string;
  onDeclare?: (prefilledGoal?: string) => void;
  onClose?: () => void;
}) {
  const tree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const linked = api.intent.getLinkedIssues.useQuery({ intentId }, { enabled: !!intentId });
  const updateM = api.intent.updateStatus.useMutation({
    onSuccess: () => tree.refetch(),
  });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const items = useMemo(() => tree.data?.allIntents ?? [], [tree.data]);
  const intent = useMemo(() => items.find((i) => i.id === intentId), [items, intentId]);
  const parent = useMemo(
    () => (intent?.parentId ? items.find((i) => i.id === intent.parentId) : null),
    [items, intent]
  );
  const children = useMemo(() => items.filter((i) => i.parentId === intentId), [items, intentId]);

  const parsedChanges = useMemo(() => {
    if (!intent?.changesJson) return [];
    try {
      return JSON.parse(intent.changesJson) as Array<{
        label: string;
        kind?: string;
        deltaPercent?: number;
        deptCategory?: string;
        operation?: string;
        targetModel?: string;
        targetField?: string;
      }>;
    } catch {
      return [];
    }
  }, [intent?.changesJson]);

  if (!intent) {
    return (
      <div className="text-label-secondary text-body py-8 text-center">
        This directive could not be loaded.
      </div>
    );
  }

  const brokerInfo = CATEGORY_BROKER_MAP[intent.category?.toLowerCase()] || {
    name: "Cabinet Administration",
    icon: Command,
  };
  const BrokerIcon = brokerInfo.icon;
  const progress = Math.min(100, Math.max(0, linked.data?.progress ?? 0));

  const handleCopySummary = () => {
    if (intent.summary) {
      navigator.clipboard.writeText(intent.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleChainDirective = () => {
    if (onClose) onClose();
    if (onDeclare) {
      onDeclare(`Follow-up to "${intent.goal}": `);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Directive header */}
      <FacetCard className="rounded-card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("capitalize", TIER_TONE[intent.tier] ?? "text-label-secondary")}
            >
              {intent.tier} tier
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {intent.category}
            </Badge>
            {intent.target && <Badge variant="outline">Target: {intent.target}</Badge>}
          </div>

          <Badge variant="outline" className="capitalize">
            <span
              aria-hidden="true"
              className={cn("h-1.5 w-1.5 rounded-full", statusDot(intent.status || "active"))}
            />
            {intent.status || "active"}
          </Badge>
        </div>

        <div>
          <h2 className="text-label text-title-2">{intent.goal}</h2>
          <p className="text-label-secondary text-footnote mt-1">
            Enacted on{" "}
            {new Date(intent.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Actions: one gold primary, quiet secondaries */}
        <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            size="sm"
            onClick={handleChainDirective}
            className="h-11 font-semibold sm:h-8"
          >
            <Command aria-hidden="true" />
            Build on this
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {intent.summary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopySummary}
                className="h-11 sm:h-8"
              >
                {copied ? (
                  <Check aria-hidden="true" className="text-green" />
                ) : (
                  <Share2 aria-hidden="true" />
                )}
                {copied ? "Copied" : "Share"}
              </Button>
            )}

            {intent.status === "active" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateM.mutate({ id: intent.id, status: "completed" })}
                disabled={updateM.isPending}
                className="h-11 sm:h-8"
              >
                <CheckCircle2 aria-hidden="true" />
                Complete directive
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsShareModalOpen(true)}
              className="h-11 sm:h-8"
            >
              <BookOpen aria-hidden="true" />
              Share to ThinkPages…
            </Button>
          </div>
        </div>
      </FacetCard>

      {/* Quick Confirmation Modal for ThinkPages Publishing */}
      <ThinkPagesShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        intentId={intent.id}
        countryId={countryId}
        goal={intent.goal}
        tier={intent.tier}
        category={intent.category}
        summary={intent.summary ?? undefined}
        changesJson={intent.changesJson ?? undefined}
      />

      {/* Executive narrative summary */}
      {intent.summary && (
        <SheetSection title="Narrative summary" icon={BookOpen}>
          <p className="text-label-secondary text-footnote leading-relaxed">{intent.summary}</p>
        </SheetSection>
      )}

      {/* Resistance progress (linked national issues) */}
      <SheetSection
        title="Resistance progress"
        icon={Shield}
        accessory={
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {linked.data?.resolvedCount ?? 0} / {linked.data?.totalCount ?? 0} resolved
          </Badge>
        }
      >
        <div
          className="bg-fill-3 h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Resistance resolved"
        >
          <div
            className={cn(
              "h-full rounded-full",
              progress >= 100 ? "bg-green" : progress > 0 ? "bg-yellow" : "bg-fill"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {linked.data && linked.data.issues.length > 0 ? (
          <ul className="divide-separator mt-3 divide-y">
            {linked.data.issues.map((iss) => {
              const done = ["responded", "auto_resolved", "dismissed"].includes(iss.status);
              return (
                <li
                  key={iss.id}
                  className="text-footnote flex items-center justify-between gap-2 py-2 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        done
                          ? "bg-green"
                          : iss.status === "viewed"
                            ? "bg-orange"
                            : "bg-label-tertiary"
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 truncate font-medium",
                        done ? "text-label-secondary" : "text-label"
                      )}
                    >
                      {iss.title}
                    </span>
                  </div>
                  <span className="text-label-secondary shrink-0 capitalize">
                    {iss.status.replace(/_/g, " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-label-secondary text-footnote mt-3">
            No active resistance. The directive is proceeding without friction.
          </p>
        )}
      </SheetSection>

      {/* Decision tree */}
      <IntentBranchingTree countryId={countryId} currentIntentId={intent.id} />

      {/* Aligned power broker */}
      <FacetCard className="rounded-card flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrokerIcon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <Eyebrow className="block">Aligned power broker</Eyebrow>
            <p className="text-label text-body truncate font-medium">{brokerInfo.name}</p>
          </div>
        </div>
        <Badge variant="green" className="shrink-0">
          Cabinet aligned
        </Badge>
      </FacetCard>

      {/* Applied policy line-items */}
      {parsedChanges.length > 0 && (
        <SheetSection
          title="Applied line-items"
          icon={Sliders}
          accessory={<Badge variant="secondary">{parsedChanges.length}</Badge>}
        >
          <ol className="divide-separator divide-y">
            {parsedChanges.map((change, idx) => (
              <li
                key={idx}
                className="text-footnote flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="border-tint/20 bg-tint/10 text-tint font-data flex size-6 shrink-0 items-center justify-center rounded-lg border font-semibold tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="text-label font-medium">{change.label}</span>
                </div>
                {change.deltaPercent !== undefined && (
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      change.deltaPercent > 0 ? "text-green" : "text-destructive"
                    )}
                  >
                    {change.deltaPercent > 0
                      ? `+${change.deltaPercent}%`
                      : `${change.deltaPercent}%`}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </SheetSection>
      )}

      {/* Chained initiatives (parent and follow-ups) */}
      {(parent || children.length > 0) && (
        <SheetSection title="Chained initiatives" icon={Layers}>
          <div className="space-y-3">
            {parent && (
              <div className="space-y-1">
                <Eyebrow className="block">Parent initiative</Eyebrow>
                <div className="text-footnote flex items-center justify-between gap-2">
                  <span className="text-label font-medium">{parent.goal}</span>
                  <span className="text-label-secondary shrink-0 capitalize">{parent.tier}</span>
                </div>
              </div>
            )}

            {children.length > 0 && (
              <div className="space-y-1">
                <Eyebrow className="block">Follow-up directives ({children.length})</Eyebrow>
                <ul className="space-y-2">
                  {children.map((kid) => (
                    <li
                      key={kid.id}
                      className="text-footnote flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <CornerDownRight
                          aria-hidden="true"
                          className="text-label-secondary h-3.5 w-3.5 shrink-0"
                        />
                        <span className="text-label font-medium">{kid.goal}</span>
                      </div>
                      <span className="text-label-secondary shrink-0 capitalize">{kid.tier}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SheetSection>
      )}
    </div>
  );
}

export interface DrillSheetsProps {
  drill: DrillSheetKind;
  onClose: () => void;
  countryId: string;
  onDeclare?: (prefilledGoal?: string) => void;
}

export type V2DrillSheetsProps = DrillSheetsProps;

function DrillSheetsComponent({
  drill,
  onClose,
  countryId,
  onDeclare,
}: DrillSheetsProps): React.JSX.Element {
  const open = drill !== null;

  const kindKind = drill === null ? "relations" : drill.kind;
  const meta =
    kindKind === "intent" || kindKind === "issue" ? null : DOMAIN_META[kindKind as V2Domain];

  const title =
    drill === null
      ? ""
      : drill.kind === "intent"
        ? "Directive Detail"
        : drill.kind === "issue"
          ? "Issue Brief"
          : (meta?.sheetTitle ?? "");
  const Icon =
    drill === null
      ? Target
      : drill.kind === "intent"
        ? Target
        : drill.kind === "issue"
          ? AlertTriangle
          : (meta?.icon ?? Target);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="border-separator bg-surface w-full overflow-y-auto backdrop-blur-xl sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-headline flex items-center gap-3">
              {/* v2: the sheet's glyph in its domain hue (gold for directives and issues) */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                  HUE_PAINT[hueOf(drill?.kind) ?? "yellow"].badge
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {title}
            </SheetTitle>
            {drill && drill.kind !== "intent" && drill.kind !== "issue" && (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link
                  href={`/countries/${encodeURIComponent(countryId)}#${drill.kind}`}
                  target="_blank"
                >
                  Open page
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
          {drill && drill.kind !== "intent" && (
            <SheetDescription className="text-label-secondary text-footnote">
              {meta?.blurb}
            </SheetDescription>
          )}
        </SheetHeader>

        {drill === null ? null : drill.kind === "intent" ? (
          <IntentDetail
            countryId={countryId}
            intentId={drill.intentId}
            onDeclare={onDeclare}
            onClose={onClose}
          />
        ) : drill.kind === "issue" ? (
          <IssueDetailBrief issueId={drill.issueId} onDeclare={onDeclare} onClose={onClose} />
        ) : drill.kind === "relations" ? (
          <EmbassiesAndRelationsPanel countryId={countryId} />
        ) : drill.kind === "defense" ? (
          <DefenseCommandPanel countryId={countryId} />
        ) : drill.kind === "politics" ? (
          <PoliticsDrillDown countryId={countryId} />
        ) : drill.kind === "economy" ? (
          <EconomyDrillDown countryId={countryId} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export const DrillSheets = React.memo(DrillSheetsComponent);
export const V2DrillSheets = DrillSheets;
