"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { formatBanDate } from "~/lib/thinkpages-forum/moderation-policy";
import { api, type RouterOutputs } from "~/trpc/react";
import { AppealDialog } from "./AppealDialog";

type Standing = RouterOutputs["thinkpagesForum"]["myStanding"];
type Warning = Standing["warnings"][number];
type Ban = Standing["bans"][number];
type Appeal = Standing["appeals"][number];
type Subject = { type: "warning" | "ban"; id: string };

const APPEAL_STATUS: Record<Appeal["status"], string> = {
  open: "Appeal open",
  upheld: "Appeal upheld",
  overturned: "Appeal overturned",
  moot: "Appeal closed, it had already ended",
};

const points = (n: number) => (n === 1 ? "1 point" : `${n} points`);

/** A standing lists warnings of the last 90 days, so one not revoked has not expired yet. */
function warningState(warning: Warning): string {
  return warning.revokedAt ? "Revoked" : `Expires ${formatBanDate(warning.expiresAt)}`;
}

function banPlace(ban: Ban): string {
  if (ban.scope === "site") return "Banned from the forum";
  return ban.scopeName ? `Banned from ${ban.scopeName}` : "Banned from part of the forum";
}

/** The appeal's state and the moderator's response, as text. */
function AppealLine({ appeal }: { appeal: Appeal | null }) {
  if (!appeal) return null;
  return (
    <>
      <p className="text-footnote text-label-secondary">{APPEAL_STATUS[appeal.status]}</p>
      {appeal.response ? (
        <p className="text-footnote text-label-secondary">{`Response: ${appeal.response}`}</p>
      ) : null}
    </>
  );
}

interface RowProps {
  title: ReactNode;
  reason: string;
  detail: string;
  appeal: Appeal | null;
  onAppeal: (() => void) | null;
}

function StandingRow({ title, reason, detail, appeal, onAppeal }: RowProps) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-headline text-label flex flex-wrap items-center gap-2">{title}</p>
        <p className="text-callout text-label break-words">{reason}</p>
        <p className="text-footnote text-label-secondary tabular-nums">{detail}</p>
        <AppealLine appeal={appeal} />
      </div>
      {onAppeal ? (
        <Button variant="secondary" size="sm" onClick={onAppeal}>
          Appeal
        </Button>
      ) : null}
    </li>
  );
}

/**
 * The member's own warnings, bans and appeals (M20), on the forum home at `#standing` where ban notices link:
 * nothing for a member in good standing. Never who issued or reviewed anything; the server sends no such field.
 */
export function StandingCard() {
  const { data } = api.thinkpagesForum.myStanding.useQuery();
  const [appealing, setAppealing] = useState<Subject | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const hasStanding = !!data && data.warnings.length + data.bans.length + data.appeals.length > 0;

  // The `#standing` link (a ban notice's Appeal) points at a card that only exists once the data loads: scroll to
  // it then, once, so a refetch leaves the reader where they are.
  useEffect(() => {
    if (!hasStanding || scrolled.current || window.location.hash !== "#standing") return;
    card.current?.scrollIntoView({ block: "start" });
    scrolled.current = true;
  }, [hasStanding]);

  if (!data || !hasStanding) return null;

  const shown = new Set([...data.warnings.map((w) => w.id), ...data.bans.map((b) => b.id)]);
  const others = data.appeals.filter((a) => !shown.has(a.subjectId));

  return (
    <Card ref={card} content="data" id="standing" className="scroll-mt-24 overflow-hidden">
      <div className="space-y-1 px-4 pt-4 pb-3">
        <h2 className="text-title-3 text-label">Your standing</h2>
        <p className="text-footnote text-label-secondary tabular-nums">
          {`Active warning points: ${data.activePoints}`}
        </p>
      </div>
      <ul className="divide-separator border-separator divide-y border-t">
        {data.warnings.map((w) => (
          <StandingRow
            key={w.id}
            title={points(w.points)}
            reason={w.reason}
            detail={warningState(w)}
            appeal={w.appeal}
            onAppeal={w.canAppeal ? () => setAppealing({ type: "warning", id: w.id }) : null}
          />
        ))}
        {data.bans.map((b) => (
          <StandingRow
            key={b.id}
            title={
              <>
                {banPlace(b)}
                {b.auto ? <Badge>Automatic</Badge> : null}
              </>
            }
            reason={b.reason}
            detail={
              b.expiresAt ? `Until ${formatBanDate(b.expiresAt)}` : "Until a moderator lifts it"
            }
            appeal={b.appeal}
            onAppeal={b.canAppeal ? () => setAppealing({ type: "ban", id: b.id }) : null}
          />
        ))}
        {others.map((a) => (
          <li key={a.id} className="space-y-0.5 px-4 py-3">
            <p className="text-headline text-label">{`Your appeal of a ${a.subjectType ?? "decision"}`}</p>
            <AppealLine appeal={a} />
          </li>
        ))}
      </ul>
      {appealing ? (
        <AppealDialog
          subjectType={appealing.type}
          subjectId={appealing.id}
          open
          onOpenChange={(next) => {
            if (!next) setAppealing(null);
          }}
        />
      ) : null}
    </Card>
  );
}
