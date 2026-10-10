"use client";

import { useEffect, useState, type ReactNode } from "react";
import { UserCircle } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatBanDate } from "~/lib/thinkpages-forum/moderation-policy";
import { type RouterOutputs } from "~/trpc/react";
import { AppealDialog } from "./AppealDialog";
import { RailPanel } from "./shell";

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
    <li className="flex items-start gap-3 py-3">
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

/** Whether a standing has anything to show: a member in good standing gets no panel. */
export function hasStanding(data: Standing | undefined): data is Standing {
  return !!data && data.warnings.length + data.bans.length + data.appeals.length > 0;
}

/**
 * The member's own warnings, bans and appeals (M20), as a rail panel on the forum home at `#standing` where ban
 * notices link. Never who issued or reviewed anything; the server sends no such field. When the link was `#standing`
 * the panel scrolls into view once it mounts (it only exists after the standing loads).
 */
export function StandingPanel({ standing }: { standing: Standing }) {
  const [appealing, setAppealing] = useState<Subject | null>(null);

  useEffect(() => {
    if (window.location.hash === "#standing") {
      document.getElementById("standing")?.scrollIntoView({ block: "start" });
    }
  }, []);

  const shown = new Set([...standing.warnings.map((w) => w.id), ...standing.bans.map((b) => b.id)]);
  const others = standing.appeals.filter((a) => !shown.has(a.subjectId));

  return (
    <RailPanel title="Your standing" icon={<UserCircle />} id="standing">
      <p className="text-footnote text-label-secondary tabular-nums">
        {`Active warning points: ${standing.activePoints}`}
      </p>
      <ul className="divide-separator mt-2 divide-y">
        {standing.warnings.map((w) => (
          <StandingRow
            key={w.id}
            title={points(w.points)}
            reason={w.reason}
            detail={warningState(w)}
            appeal={w.appeal}
            onAppeal={w.canAppeal ? () => setAppealing({ type: "warning", id: w.id }) : null}
          />
        ))}
        {standing.bans.map((b) => (
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
          <li key={a.id} className="space-y-0.5 py-3">
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
    </RailPanel>
  );
}
