"use client";

import React, { useId, useState } from "react";
import { CheckCircle, GitFork, NavArrowDown, OpenNewWindow, Refresh, Undo } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { KitButton } from "~/components/mycountry/directives/KitButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { cn } from "~/lib/utils";
import { formatIxCountdown } from "~/lib/statecraft/calendar";
import { DirectiveOutcome } from "./DirectiveOutcome";
import {
  PHASE_META,
  TONE_CLASSES,
  categoryLabel,
  directiveTimeline,
  formatIxDate,
  parseChangeLines,
  tierMeta,
  type IntentRow,
} from "./directive-model";

const RESOLVED_ISSUE = new Set(["responded", "auto_resolved", "dismissed"]);
const ISSUE_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting response",
  viewed: "Awaiting response",
  responded: "Resolved",
  auto_resolved: "Resolved automatically",
  dismissed: "Delegated",
  expired: "Expired",
};

export interface DirectiveCardProps {
  intent: IntentRow;
  parentGoal?: string | null;
  nowIxTime: number;
  onFollowUp?: (ref: { id: string; goal: string }) => void;
  onReuseGoal?: (goal: string) => void;
  onOpenIntent?: (intentId: string) => void;
  onOpenIssue?: (issueId: string) => void;
  readOnly?: boolean;
}

function Meter({
  label,
  value,
  detail,
  barClass,
}: {
  label: string;
  value: number;
  detail: string;
  barClass: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground truncate font-medium">{detail}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full"
      >
        <div
          className={cn("h-full w-full origin-left rounded-full", barClass)}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
}

/** One directive: status, progress and actions up front; recorded effects on expand. */
export function DirectiveCard({
  intent,
  parentGoal,
  nowIxTime,
  onFollowUp,
  onReuseGoal,
  onOpenIntent,
  onOpenIssue,
  readOnly,
}: DirectiveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const notify = useNotify();
  const utils = api.useUtils();

  const timeline = directiveTimeline(intent, nowIxTime);
  const phase = PHASE_META[timeline.phase];
  const isOpen = timeline.phase === "executing" || timeline.phase === "in_force";
  const meta = tierMeta(intent.tier);
  const changes = parseChangeLines(intent.changesJson);

  const linked = api.intent.getLinkedIssues.useQuery(
    { intentId: intent.id },
    { enabled: isOpen || expanded, staleTime: 30_000 }
  );
  const openResistance = (linked.data?.issues ?? []).filter(
    (i) => !RESOLVED_ISSUE.has(i.status) && i.status !== "expired"
  ).length;

  const update = api.intent.updateStatus.useMutation({
    onSuccess: (_res, vars) => {
      void utils.intent.getTree.invalidate();
      void utils.intent.getStatus.invalidate();
      void utils.policies.getPolicyReconContext.invalidate();
      if (vars.status === "completed") {
        notify.success("Directive completed", "A ThinkPages summary draft is ready for you.");
      } else {
        notify.success("Directive abandoned", "Its CivCap has been released.");
      }
    },
    onError: (e) => notify.error("Could not update directive", e.message),
  });

  const resistanceDetail = !linked.data
    ? "Checking…"
    : linked.data.totalCount === 0
      ? "None raised"
      : `${linked.data.resolvedCount} of ${linked.data.totalCount} resolved`;

  return (
    <article className="border-border bg-card rounded-2xl border">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium",
              TONE_CLASSES[phase.tone].chip
            )}
            title={phase.hint}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", TONE_CLASSES[phase.tone].dot)} />
            {phase.label}
          </span>
          <span className="text-muted-foreground">{categoryLabel(intent.category)}</span>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <span className="text-muted-foreground">{meta.label}</span>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <span className="text-muted-foreground">{formatIxDate(intent.createdIxTime)}</span>
        </div>

        <div>
          <h3 className="text-foreground text-base leading-snug font-semibold">{intent.goal}</h3>
          {parentGoal && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
              <GitFork className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Follow-up to {parentGoal}</span>
            </p>
          )}
        </div>

        {isOpen && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Meter
              label="Execution week"
              value={timeline.executionProgress}
              detail={
                timeline.releasesAt
                  ? `${timeline.heldCivCap} CivCap held · ${formatIxCountdown(timeline.releasesAt, nowIxTime)} left`
                  : "Done · CivCap released"
              }
              barClass={TONE_CLASSES[timeline.releasesAt ? "caution" : "info"].bar}
            />
            <Meter
              label="Resistance"
              value={
                linked.data && linked.data.totalCount > 0
                  ? linked.data.resolvedCount / linked.data.totalCount
                  : linked.data
                    ? 1
                    : 0
              }
              detail={resistanceDetail}
              barClass={TONE_CLASSES[openResistance > 0 ? "negative" : "positive"].bar}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <KitButton
            variant="ghost"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((v) => !v)}
            className="-ml-2.5"
          >
            <NavArrowDown
              className={cn(
                "transition-transform duration-150",
                expanded ? "rotate-180" : "rotate-0"
              )}
            />
            {expanded ? "Hide effects" : "Effects & resistance"}
          </KitButton>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {onOpenIntent && (
              <KitButton variant="ghost" onClick={() => onOpenIntent(intent.id)}>
                <OpenNewWindow /> Record
              </KitButton>
            )}
            {!isOpen && onReuseGoal && !readOnly && (
              <KitButton variant="secondary" onClick={() => onReuseGoal(intent.goal)}>
                <Refresh /> Declare again
              </KitButton>
            )}
            {isOpen && onFollowUp && !readOnly && (
              <KitButton
                variant="secondary"
                onClick={() => onFollowUp({ id: intent.id, goal: intent.goal })}
              >
                <GitFork /> Follow up
              </KitButton>
            )}
            {isOpen && !readOnly && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <KitButton variant="secondary" disabled={update.isPending}>
                    <Undo /> Abandon
                  </KitButton>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Abandon this directive?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &ldquo;{intent.goal}&rdquo; will stop executing and release any CivCap it
                      holds. Effects already applied stay in place.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => update.mutate({ id: intent.id, status: "abandoned" })}
                    >
                      Abandon directive
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isOpen && !readOnly && (
              <KitButton
                variant="secondary"
                disabled={update.isPending || !linked.data || openResistance > 0}
                title={
                  openResistance > 0
                    ? `Resolve ${openResistance} open resistance issue${openResistance === 1 ? "" : "s"} first`
                    : undefined
                }
                onClick={() => update.mutate({ id: intent.id, status: "completed" })}
              >
                <CheckCircle className={TONE_CLASSES.positive.text} /> Complete
              </KitButton>
            )}
          </div>
        </div>
        {isOpen && openResistance > 0 && !readOnly && (
          <p className="text-muted-foreground -mt-2 text-xs">
            Resolve {openResistance} open resistance issue{openResistance === 1 ? "" : "s"} before
            completing.
          </p>
        )}
      </div>

      {expanded && (
        <div id={panelId} className="border-border space-y-6 border-t p-4 sm:p-5">
          <section>
            <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Recorded effects
            </h4>
            <DirectiveOutcome intentId={intent.id} />
          </section>

          {changes.length > 0 && (
            <section>
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Levers pulled
              </h4>
              <ul className="space-y-1.5">
                {changes.map((c, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-foreground first-letter:uppercase">{c.label}</span>
                    {c.detail && <span className="text-muted-foreground"> — {c.detail}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Resistance
            </h4>
            {linked.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (linked.data?.issues.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No resistance issues were raised.</p>
            ) : (
              <ul className="divide-border border-border divide-y rounded-xl border">
                {linked.data!.issues.map((issue) => {
                  const resolved = RESOLVED_ISSUE.has(issue.status);
                  return (
                    <li key={issue.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          TONE_CLASSES[resolved ? "positive" : "negative"].dot
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-sm">{issue.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
                          {issue.chosenOptionLabel ? ` · ${issue.chosenOptionLabel}` : ""}
                        </p>
                      </div>
                      {!resolved && onOpenIssue && !readOnly && (
                        <KitButton variant="secondary" onClick={() => onOpenIssue(issue.id)}>
                          Respond
                        </KitButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {intent.summary && (
            <section>
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Summary
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed">{intent.summary}</p>
            </section>
          )}
        </div>
      )}
    </article>
  );
}
