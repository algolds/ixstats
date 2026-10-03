"use client";

import React, { useState } from "react";
import {
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
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { STATUS_TEXT } from "./status-tone";
import { ThinkPagesShareModal } from "~/components/mycountry/shared/modals/ThinkPagesShareModal";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
    <Card className={cn("rounded-card", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
          <h3 className="text-label text-headline">{title}</h3>
        </div>
        {accessory}
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
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

type IntentItem = NonNullable<RouterOutputs["intent"]["getTree"]>["allIntents"][number];
type LinkedIssues = RouterOutputs["intent"]["getLinkedIssues"] | undefined;

interface ParsedChange {
  label: string;
  deltaPercent?: number;
}

function parseChanges(json: string | null | undefined): ParsedChange[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as ParsedChange[];
  } catch {
    return [];
  }
}

const detailButton = "h-11 sm:h-8";

function IntentHeader({
  intent,
  isUpdating,
  onBuildOn,
  onComplete,
  onShareToThinkPages,
}: {
  intent: IntentItem;
  isUpdating: boolean;
  onBuildOn: () => void;
  onComplete: () => void;
  onShareToThinkPages: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copySummary = () => {
    if (!intent.summary) return;
    void navigator.clipboard.writeText(intent.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="rounded-card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("capitalize", TIER_TONE[intent.tier] ?? "text-label-secondary")}
          >
            {intent.tier} tier
          </Badge>
          <Badge variant="default" className="capitalize">
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
        <Button type="button" size="sm" onClick={onBuildOn} className="h-11 font-semibold sm:h-8">
          <Command aria-hidden="true" />
          Build on this
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {intent.summary && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copySummary}
              className={detailButton}
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
              onClick={onComplete}
              disabled={isUpdating}
              className={detailButton}
            >
              <CheckCircle2 aria-hidden="true" />
              Complete directive
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onShareToThinkPages}
            className={detailButton}
          >
            <BookOpen aria-hidden="true" />
            Share to ThinkPages…
          </Button>
        </div>
      </div>
    </Card>
  );
}

const RESOLVED_STATUSES = ["responded", "auto_resolved", "dismissed"];

function issueDotTone(status: string): string {
  if (RESOLVED_STATUSES.includes(status)) return "bg-green";
  return status === "viewed" ? "bg-orange" : "bg-label-tertiary";
}

function ResistanceProgress({ linked }: { linked: LinkedIssues }) {
  const progress = Math.min(100, Math.max(0, linked?.progress ?? 0));
  return (
    <SheetSection
      title="Resistance progress"
      icon={Shield}
      accessory={
        <Badge variant="default" className="shrink-0 tabular-nums">
          {linked?.resolvedCount ?? 0} / {linked?.totalCount ?? 0} resolved
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

      {linked && linked.issues.length > 0 ? (
        <ul className="divide-separator mt-3 divide-y">
          {linked.issues.map((iss) => (
            <li
              key={iss.id}
              className="text-footnote flex items-center justify-between gap-2 py-2 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", issueDotTone(iss.status))}
                />
                <span
                  className={cn(
                    "min-w-0 truncate font-medium",
                    RESOLVED_STATUSES.includes(iss.status) ? "text-label-secondary" : "text-label"
                  )}
                >
                  {iss.title}
                </span>
              </div>
              <span className="text-label-secondary shrink-0 capitalize">
                {iss.status.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-label-secondary text-footnote mt-3">
          No active resistance. The directive is proceeding without friction.
        </p>
      )}
    </SheetSection>
  );
}

function BrokerCard({ category }: { category: string | null | undefined }) {
  const broker = CATEGORY_BROKER_MAP[category?.toLowerCase() ?? ""] ?? {
    name: "Cabinet Administration",
    icon: Command,
  };
  const BrokerIcon = broker.icon;
  return (
    <Card className="rounded-card flex items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <BrokerIcon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <Eyebrow className="block">Aligned power broker</Eyebrow>
          <p className="text-label text-body truncate font-medium">{broker.name}</p>
        </div>
      </div>
      <Badge variant="success" className="shrink-0">
        Cabinet aligned
      </Badge>
    </Card>
  );
}

function AppliedLineItems({ changes }: { changes: ParsedChange[] }) {
  return (
    <SheetSection
      title="Applied line-items"
      icon={Sliders}
      accessory={<Badge variant="default">{changes.length}</Badge>}
    >
      <ol className="divide-separator divide-y">
        {changes.map((change, idx) => (
          <li
            key={idx}
            className="text-footnote flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="bg-fill-3 text-label-secondary flex size-6 shrink-0 items-center justify-center rounded-lg font-semibold tabular-nums">
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
                {change.deltaPercent > 0 ? "+" : ""}
                {change.deltaPercent}%
              </span>
            )}
          </li>
        ))}
      </ol>
    </SheetSection>
  );
}

function ChainedInitiatives({
  parent,
  followUps,
}: {
  parent: IntentItem | null;
  followUps: IntentItem[];
}) {
  return (
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

        {followUps.length > 0 && (
          <div className="space-y-1">
            <Eyebrow className="block">Follow-up directives ({followUps.length})</Eyebrow>
            <ul className="space-y-2">
              {followUps.map((kid) => (
                <li key={kid.id} className="text-footnote flex items-center justify-between gap-2">
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
  );
}

export function IntentDetail({
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

  const items = tree.data?.allIntents ?? [];
  const intent = items.find((i) => i.id === intentId);

  if (!intent) {
    return (
      <div className="text-label-secondary text-body py-8 text-center">
        This directive could not be loaded.
      </div>
    );
  }

  const parent = intent.parentId ? (items.find((i) => i.id === intent.parentId) ?? null) : null;
  const followUps = items.filter((i) => i.parentId === intentId);
  const changes = parseChanges(intent.changesJson);

  return (
    <div className="space-y-4 pb-4">
      <IntentHeader
        intent={intent}
        isUpdating={updateM.isPending}
        onBuildOn={() => {
          onClose?.();
          onDeclare?.(`Follow-up to "${intent.goal}": `);
        }}
        onComplete={() => updateM.mutate({ id: intent.id, status: "completed" })}
        onShareToThinkPages={() => setIsShareModalOpen(true)}
      />

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

      {intent.summary && (
        <SheetSection title="Narrative summary" icon={BookOpen}>
          <p className="text-label-secondary text-footnote leading-relaxed">{intent.summary}</p>
        </SheetSection>
      )}

      <ResistanceProgress linked={linked.data} />
      <IntentBranchingTree countryId={countryId} currentIntentId={intent.id} />
      <BrokerCard category={intent.category} />
      {changes.length > 0 && <AppliedLineItems changes={changes} />}
      {(parent || followUps.length > 0) && (
        <ChainedInitiatives parent={parent} followUps={followUps} />
      )}
    </div>
  );
}
