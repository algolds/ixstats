"use client";

import React, { useId, useState } from "react";
import { CheckCircle, GitFork, NavArrowDown, OpenNewWindow, Refresh, Undo } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
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
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
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
import { Card } from "~/components/ui/card";

const RESOLVED_ISSUE = new Set(["responded", "auto_resolved", "dismissed"]);
const ISSUE_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting response",
  viewed: "Awaiting response",
  responded: "Resolved",
  auto_resolved: "Resolved automatically",
  dismissed: "Delegated",
  expired: "Expired",
};

interface DirectiveCardProps {
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
      <div className="text-footnote flex items-baseline justify-between gap-2">
        <span className="text-label-secondary">{label}</span>
        <span className="text-label truncate font-medium">{detail}</span>
      </div>
      <Progress
        value={pct}
        aria-label={label}
        className="bg-fill-3 mt-2 h-1.5"
        indicatorClassName={barClass}
      />
    </div>
  );
}

function TapButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button className={cn("max-sm:h-11", className)} {...props} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2">
        <Eyebrow>{title}</Eyebrow>
      </h4>
      {children}
    </section>
  );
}

type LinkedIssues = RouterOutputs["intent"]["getLinkedIssues"];

function ResistanceList({
  issues,
  onOpenIssue,
}: {
  issues: LinkedIssues["issues"];
  onOpenIssue?: (issueId: string) => void;
}) {
  return (
    <Card variant="well" padding="none">
      <ul className="divide-separator divide-y">
        {issues.map((issue) => {
          const resolved = RESOLVED_ISSUE.has(issue.status);
          return (
            <li key={issue.id} className="flex items-center gap-3 px-3 py-2">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  TONE_CLASSES[resolved ? "positive" : "negative"].dot
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-label text-body truncate">{issue.title}</p>
                <p className="text-label-secondary text-footnote">
                  {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
                  {issue.chosenOptionLabel ? ` · ${issue.chosenOptionLabel}` : ""}
                </p>
              </div>
              {!resolved && onOpenIssue && (
                <TapButton variant="outline" size="sm" onClick={() => onOpenIssue(issue.id)}>
                  Respond
                </TapButton>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AbandonDialog({
  goal,
  disabled,
  onConfirm,
}: {
  goal: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <TapButton variant="outline" disabled={disabled}>
          <Undo /> Abandon
        </TapButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abandon this directive?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{goal}&rdquo; will stop executing and release any CivCap it holds. Effects
            already applied stay in place.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onConfirm}
          >
            Abandon directive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const plural = (n: number) => `${n} open resistance issue${n === 1 ? "" : "s"}`;

function resistanceSummary(data: LinkedIssues | undefined) {
  const total = data?.totalCount ?? 0;
  const resolved = data?.resolvedCount ?? 0;
  if (!data) return { value: 0, detail: "Checking…" };
  if (total === 0) return { value: 1, detail: "None raised" };
  return { value: resolved / total, detail: `${resolved} of ${total} resolved` };
}

function ProgressMeters({
  timeline,
  nowIxTime,
  linked,
  openResistance,
}: {
  timeline: ReturnType<typeof directiveTimeline>;
  nowIxTime: number;
  linked: LinkedIssues | undefined;
  openResistance: number;
}) {
  const resistance = resistanceSummary(linked);
  return (
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
        value={resistance.value}
        detail={resistance.detail}
        barClass={TONE_CLASSES[openResistance > 0 ? "negative" : "positive"].bar}
      />
    </div>
  );
}

function DirectiveDetails({
  id,
  intent,
  linked,
  onOpenIssue,
}: {
  id: string;
  intent: IntentRow;
  linked: { isLoading: boolean; data: LinkedIssues | undefined };
  onOpenIssue?: (issueId: string) => void;
}) {
  const changes = parseChangeLines(intent.changesJson);
  const issues = linked.data?.issues ?? [];
  return (
    <div id={id} className="border-separator space-y-6 border-t p-4 sm:p-5">
      <Section title="Recorded effects">
        <DirectiveOutcome intentId={intent.id} />
      </Section>

      {changes.length > 0 && (
        <Section title="Levers pulled">
          <ul className="space-y-2">
            {changes.map((c, i) => (
              <li key={i} className="text-body">
                <span className="text-label first-letter:uppercase">{c.label}</span>
                {c.detail && <span className="text-label-secondary"> — {c.detail}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Resistance">
        {linked.isLoading ? (
          <p className="text-label-secondary text-body">Loading…</p>
        ) : issues.length === 0 ? (
          <p className="text-label-secondary text-body">No resistance issues were raised.</p>
        ) : (
          <ResistanceList issues={issues} onOpenIssue={onOpenIssue} />
        )}
      </Section>

      {intent.summary && (
        <Section title="Summary">
          <p className="text-label-secondary text-body leading-relaxed">{intent.summary}</p>
        </Section>
      )}
    </div>
  );
}

function DirectiveActions({
  intent,
  isOpen,
  readOnly,
  expanded,
  panelId,
  onToggle,
  pending,
  linkedReady,
  openResistance,
  setStatus,
  handlers: { onFollowUp, onReuseGoal, onOpenIntent },
}: {
  intent: IntentRow;
  isOpen: boolean;
  readOnly?: boolean;
  expanded: boolean;
  panelId: string;
  onToggle: () => void;
  pending: boolean;
  linkedReady: boolean;
  openResistance: number;
  setStatus: (status: "completed" | "abandoned") => void;
  handlers: Pick<DirectiveCardProps, "onFollowUp" | "onReuseGoal" | "onOpenIntent">;
}) {
  const canAct = isOpen && !readOnly;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <TapButton
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => onToggle()}
          className="-ml-3"
        >
          <NavArrowDown
            className={cn(
              "transition-transform duration-150",
              expanded ? "rotate-180" : "rotate-0"
            )}
          />
          {expanded ? "Hide effects" : "Effects & resistance"}
        </TapButton>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {onOpenIntent && (
            <TapButton variant="ghost" onClick={() => onOpenIntent(intent.id)}>
              <OpenNewWindow /> Record
            </TapButton>
          )}
          {!isOpen && onReuseGoal && !readOnly && (
            <TapButton variant="outline" onClick={() => onReuseGoal(intent.goal)}>
              <Refresh /> Declare again
            </TapButton>
          )}
          {canAct && onFollowUp && (
            <TapButton
              variant="outline"
              onClick={() => onFollowUp({ id: intent.id, goal: intent.goal })}
            >
              <GitFork /> Follow up
            </TapButton>
          )}
          {canAct && (
            <>
              <AbandonDialog
                goal={intent.goal}
                disabled={pending}
                onConfirm={() => setStatus("abandoned")}
              />
              <TapButton
                variant="outline"
                disabled={pending || !linkedReady || openResistance > 0}
                title={openResistance > 0 ? `Resolve ${plural(openResistance)} first` : undefined}
                onClick={() => setStatus("completed")}
              >
                <CheckCircle className={TONE_CLASSES.positive.text} /> Complete
              </TapButton>
            </>
          )}
        </div>
      </div>
      {canAct && openResistance > 0 && (
        <p className="text-label-secondary text-footnote -mt-2">
          Resolve {plural(openResistance)} before completing.
        </p>
      )}
    </>
  );
}

/**
 * One directive: status, progress and actions up front; recorded effects on expand.
 * A depth-3 Facet row (solid: it sits inside the workspace's glass shell).
 */
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
  const tone = TONE_CLASSES[phase.tone];
  const isOpen = timeline.phase === "executing" || timeline.phase === "in_force";

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
  const setStatus = (status: "completed" | "abandoned") => update.mutate({ id: intent.id, status });

  return (
    <Card className="rounded-card">
      <article>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="text-footnote flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant="outline" className={tone.badge} title={phase.hint}>
              <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
              {phase.label}
            </Badge>
            {[
              categoryLabel(intent.category),
              tierMeta(intent.tier).label,
              formatIxDate(intent.createdIxTime),
            ].map((text, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span className="text-label-secondary" aria-hidden>
                    ·
                  </span>
                )}
                <span className="text-label-secondary">{text}</span>
              </React.Fragment>
            ))}
          </div>

          <div>
            <h3 className="text-label text-title-3">{intent.goal}</h3>
            {parentGoal && (
              <p className="text-label-secondary text-footnote mt-1 flex items-center gap-2">
                <GitFork className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">Follow-up to {parentGoal}</span>
              </p>
            )}
          </div>

          {isOpen && (
            <ProgressMeters
              timeline={timeline}
              nowIxTime={nowIxTime}
              linked={linked.data}
              openResistance={openResistance}
            />
          )}

          <DirectiveActions
            intent={intent}
            isOpen={isOpen}
            readOnly={readOnly}
            expanded={expanded}
            panelId={panelId}
            onToggle={() => setExpanded((v) => !v)}
            pending={update.isPending}
            linkedReady={!!linked.data}
            openResistance={openResistance}
            setStatus={setStatus}
            handlers={{ onFollowUp, onReuseGoal, onOpenIntent }}
          />
        </div>

        {expanded && (
          <DirectiveDetails
            id={panelId}
            intent={intent}
            linked={linked}
            onOpenIssue={readOnly ? undefined : onOpenIssue}
          />
        )}
      </article>
    </Card>
  );
}
