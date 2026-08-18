"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Target,
  Command,
  BookOpen,
  Sliders,
  Layers,
  CornerDownRight,
  Check,
  CheckCircle2,
  Share2,
  Compass,
  Users2,
  Globe2,
  Shield,
  Landmark,
  Building2,
  GitBranch,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { FacetCard } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { DOMAIN_META, type V2Domain } from "./domain-meta";
import { PoliticsDrillDown } from "./PoliticsDrillDown";
import { EconomyDrillDown } from "./EconomyDrillDown";
import { ThinkPagesShareModal } from "~/components/mycountry/shared/modals/ThinkPagesShareModal";
import { IssueDetailBrief } from "~/components/mycountry/shared/headers/IssueDetailBrief";

const EmbassiesAndRelationsPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/diplomacy/EmbassiesAndRelationsPanel").then((m) => ({
      default: m.EmbassiesAndRelationsPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const DefenseCommandPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/DefenseCommandPanel").then((m) => ({
      default: m.DefenseCommandPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
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

const TIER_BADGE: Record<string, string> = {
  measured: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
  moderate: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  extreme: "text-red-300 bg-red-500/10 border-red-400/20",
};

const CATEGORY_BROKER_MAP: Record<string, { name: string; icon: any; color: string }> = {
  defense: {
    name: "Generals",
    icon: Shield,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  security: {
    name: "Generals",
    icon: Shield,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  fiscal: {
    name: "Magnates",
    icon: Building2,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  economy: {
    name: "Magnates",
    icon: Building2,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  social: {
    name: "Party",
    icon: Users2,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  infrastructure: {
    name: "Technocrats",
    icon: Compass,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  religion: {
    name: "Clergy",
    icon: Landmark,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  foreign: {
    name: "Cabinet Diplomatic Corps",
    icon: Globe2,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
};

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
    <FacetCard depth={1} className="bg-card/20 flex flex-col gap-3 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
        <GitBranch className="h-4 w-4" />
        <span>Executive Decision Tree (Branching Lineage)</span>
      </div>
      <div className="space-y-2.5 pl-2">
        {data.allIntents.slice(0, 4).map((it: any) => {
          const isCurrent = it.id === currentIntentId;
          return (
            <div
              key={it.id}
              className={cn(
                "group relative flex items-center justify-between rounded-xl border p-2 text-xs transition-all",
                isCurrent
                  ? "border-amber-500/40 bg-amber-500/10 shadow-xs"
                  : "border-border/40 bg-muted/10 hover:bg-muted/20"
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-2 w-2 shrink-0 rounded-full",
                    it.status === "completed"
                      ? "bg-emerald-400"
                      : it.status === "active"
                        ? "animate-pulse bg-amber-400"
                        : "bg-muted-foreground"
                  )}
                />
                <div className="truncate">
                  <p className="text-foreground/90 truncate font-semibold">{it.goal}</p>
                  <p className="text-muted-foreground text-[10px] capitalize">
                    {it.category} • {it.tier}
                  </p>
                </div>
              </div>
              <span className="text-muted-foreground shrink-0 font-mono text-[10px] font-bold capitalize">
                {it.status}
              </span>
            </div>
          );
        })}
      </div>
    </FacetCard>
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

  const items = useMemo(
    () => (tree.data as any)?.allIntents ?? (Array.isArray(tree.data) ? tree.data : []),
    [tree.data]
  );
  const intent = useMemo(() => items.find((i: any) => i.id === intentId), [items, intentId]);
  const parent = useMemo(
    () => (intent?.parentId ? items.find((i: any) => i.id === intent.parentId) : null),
    [items, intent]
  );
  const children = useMemo(
    () => items.filter((i: any) => i.parentId === intentId),
    [items, intentId]
  );

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
      <div className="text-muted-foreground py-8 text-center text-sm">
        This directive could not be loaded.
      </div>
    );
  }

  const brokerInfo = CATEGORY_BROKER_MAP[intent.category?.toLowerCase()] || {
    name: "Cabinet Administration",
    icon: Command,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  const BrokerIcon = brokerInfo.icon;

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
    <div className="space-y-5 pb-4">
      {/* Directive Hero Header */}
      <FacetCard depth={1} className="bg-card/40 flex flex-col gap-3 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase",
                TIER_BADGE[intent.tier] || "border-slate-500/30 bg-slate-500/10 text-slate-400"
              )}
            >
              {intent.tier} Tier
            </span>
            <span className="border-border/40 bg-muted/20 text-muted-foreground rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase">
              {intent.category}
            </span>
            {intent.target && (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-cyan-400">
                Target: {intent.target}
              </span>
            )}
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase",
              intent.status === "completed"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : intent.status === "abandoned"
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                intent.status === "completed"
                  ? "bg-emerald-400"
                  : intent.status === "abandoned"
                    ? "bg-red-400"
                    : "animate-pulse bg-amber-400"
              )}
            />
            {intent.status || "active"}
          </span>
        </div>

        <div>
          <h2 className="text-foreground text-xl leading-snug font-extrabold tracking-tight">
            {intent.goal}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            Enacted on{" "}
            {new Date(intent.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Interactive Action Bar */}
        <div className="border-border/30 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <button
            type="button"
            onClick={handleChainDirective}
            className="group inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-500 shadow-xs transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-400"
          >
            <Command className="h-3.5 w-3.5" />
            <span>Build on this →</span>
          </button>

          <div className="flex items-center gap-1.5">
            {intent.summary && (
              <button
                type="button"
                onClick={handleCopySummary}
                className="border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40 inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Share2 className="h-3 w-3" />
                )}
                <span>{copied ? "Copied" : "Share"}</span>
              </button>
            )}

            {intent.status === "active" && (
              <button
                type="button"
                onClick={() => updateM.mutate({ id: intent.id, status: "completed" })}
                disabled={updateM.isPending}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Complete Directive</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-400 shadow-xs transition-all hover:bg-purple-500/20 active:scale-95"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Share to ThinkPages...</span>
            </button>
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
        summary={intent.summary}
        changesJson={intent.changesJson}
      />

      {/* Executive Narrative Summary */}
      {intent.summary && (
        <FacetCard depth={1} className="bg-card/20 flex flex-col gap-2 p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-500 dark:text-amber-400">
            <BookOpen className="h-4 w-4" />
            <span>Executive Narrative Summary</span>
          </div>
          <p className="text-muted-foreground pl-6 text-xs leading-relaxed font-medium">
            {intent.summary}
          </p>
        </FacetCard>
      )}

      {/* Resistance Progress (linked national issues) */}
      <FacetCard depth={1} className="bg-card/20 flex flex-col gap-3 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-500 dark:text-amber-400">
            <Shield className="h-4 w-4" />
            <span>Resistance Progress</span>
          </div>
          <span className="border-border/40 bg-muted/20 text-muted-foreground rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold">
            {linked.data?.resolvedCount ?? 0} / {linked.data?.totalCount ?? 0} resolved
          </span>
        </div>

        <div className="bg-muted/50 h-2 overflow-hidden rounded-full dark:bg-white/10">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              (linked.data?.progress ?? 0) >= 100
                ? "bg-emerald-500/80"
                : (linked.data?.progress ?? 0) > 0
                  ? "bg-amber-500/80"
                  : "bg-slate-400/40"
            )}
            style={{ width: `${Math.min(100, Math.max(0, linked.data?.progress ?? 0))}%` }}
          />
        </div>

        {linked.data && linked.data.issues.length > 0 ? (
          <div className="space-y-2">
            {linked.data.issues.map((iss: any) => {
              const done = ["responded", "auto_resolved", "dismissed"].includes(iss.status);
              return (
                <div
                  key={iss.id}
                  className="border-border/40 bg-card/30 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        done
                          ? "bg-emerald-400"
                          : iss.status === "viewed"
                            ? "bg-amber-400"
                            : "bg-slate-400"
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 truncate font-semibold",
                        done ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {iss.title}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-extrabold tracking-wider uppercase",
                      done
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : iss.status === "viewed"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : "border-border/60 bg-muted/20 text-muted-foreground"
                    )}
                  >
                    {iss.status}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-[11px] font-medium">
            No active resistance. The directive is proceeding without friction.
          </p>
        )}
      </FacetCard>

      {/* RPG Decision Tree Visualizer */}
      <IntentBranchingTree countryId={countryId} currentIntentId={intent.id} />

      {/* Aligned Power Broker Telemetry */}
      <FacetCard
        depth={1}
        className="bg-card/20 flex items-center justify-between p-4 backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border",
              brokerInfo.color
            )}
          >
            <BrokerIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-foreground text-xs font-bold">Aligned Power Broker</div>
            <div className="text-muted-foreground text-[11px] font-medium">{brokerInfo.name}</div>
          </div>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-extrabold text-emerald-400">
          Cabinet Aligned
        </span>
      </FacetCard>

      {/* Applied Policy Line-Items & Stat Changes */}
      {parsedChanges.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest uppercase">
            <Sliders className="h-3.5 w-3.5 text-amber-500" />
            Applied Package Line-Items ({parsedChanges.length})
          </h4>
          <div className="space-y-2">
            {parsedChanges.map((change, idx) => (
              <FacetCard
                key={idx}
                depth={1}
                className="bg-card/20 flex items-center justify-between p-3.5 text-xs backdrop-blur-md"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-[10px] font-bold text-amber-500">
                    #{idx + 1}
                  </span>
                  <span className="text-foreground font-bold">{change.label}</span>
                </div>
                {change.deltaPercent !== undefined && (
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 font-mono text-xs font-bold",
                      change.deltaPercent > 0
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-red-500/30 bg-red-500/10 text-red-400"
                    )}
                  >
                    {change.deltaPercent > 0
                      ? `+${change.deltaPercent}%`
                      : `${change.deltaPercent}%`}
                  </span>
                )}
              </FacetCard>
            ))}
          </div>
        </div>
      )}

      {/* Chained Initiative Tree (Parents & Children) */}
      {(parent || children.length > 0) && (
        <div className="border-border/30 space-y-3 border-t pt-4">
          <h4 className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest uppercase">
            <Layers className="h-3.5 w-3.5 text-amber-500" />
            Chained Initiative Tree
          </h4>

          {parent && (
            <div className="space-y-1">
              <div className="text-muted-foreground text-[10px] font-bold uppercase">
                Parent Initiative
              </div>
              <FacetCard
                depth={1}
                className="bg-card/20 flex items-center justify-between border-l-2 border-l-amber-500 p-3 text-xs backdrop-blur-md"
              >
                <span className="text-foreground font-bold">{parent.goal}</span>
                <span className="text-[10px] font-bold text-amber-400 uppercase">
                  {parent.tier}
                </span>
              </FacetCard>
            </div>
          )}

          {children.length > 0 && (
            <div className="space-y-1">
              <div className="text-muted-foreground text-[10px] font-bold uppercase">
                Follow-up Directives ({children.length})
              </div>
              <div className="space-y-2">
                {children.map((kid: any) => (
                  <FacetCard
                    key={kid.id}
                    depth={1}
                    className="bg-card/20 flex items-center justify-between border-l-2 border-l-blue-500 p-3 pl-4 text-xs backdrop-blur-md"
                  >
                    <div className="flex items-center gap-2">
                      <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <span className="text-foreground font-bold">{kid.goal}</span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase">
                      {kid.tier}
                    </span>
                  </FacetCard>
                ))}
              </div>
            </div>
          )}
        </div>
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
  const accent = drill === null ? "text-amber-400" : (meta?.accent ?? "text-amber-400");

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="border-border bg-background/95 w-full overflow-y-auto backdrop-blur-xl sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Icon className={cn("h-4 w-4", accent)} />
              {title}
            </SheetTitle>
            {drill && drill.kind !== "intent" && drill.kind !== "issue" && (
              <Link
                href={`/countries/${encodeURIComponent(countryId)}#${drill.kind}`}
                target="_blank"
                className="group inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-400 shadow-xs transition-all hover:bg-purple-500/20 active:scale-95"
              >
                <span>Open Page</span>
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            )}
          </div>
          {drill && drill.kind !== "intent" && (
            <SheetDescription className="text-muted-foreground text-xs">
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
