"use client";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { timeAgo } from "~/lib/format/compact";
import { MOD_ROWS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  memberName,
  ModPanel,
  ModRow,
  placeName,
  useFilterChange,
  useModRefresh,
  type Members,
  type ModContext,
  type PanelProps,
} from "./ModRow";
import { NoteDialog } from "./NoteDialog";

type Appeal = RouterOutputs["thinkpagesForumMod"]["appeals"]["rows"][number];
type Status = Appeal["status"];
type Outcome = "upheld" | "overturned";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "upheld", label: "Upheld" },
  { value: "overturned", label: "Overturned" },
  { value: "moot", label: "Closed" },
] as const;

const DECIDED: Record<Exclude<Status, "open">, string> = {
  upheld: "Upheld",
  overturned: "Overturned",
  moot: "Closed, it had already ended",
};

const VERB: Record<Outcome, string> = { upheld: "Uphold", overturned: "Overturn" };
const RESPONSE_MAX = 2000;
/** Bodies longer than this start clamped to three lines, with a toggle. */
const LONG_BODY = 240;

/** What was appealed: "Ban from Caphiria forum: Flooding" or "Warning, 2 points: Rude". */
function subjectLine(appeal: Appeal, context: ModContext): string {
  const { subject } = appeal;
  if (!subject) return `The ${appeal.subjectType ?? "decision"} is gone`;
  const what =
    subject.kind === "ban"
      ? `${subject.auto ? "Automatic ban" : "Ban"} from ${placeName(context, subject.scope, subject.scopeId)}`
      : `Warning, ${subject.points === 1 ? "1 point" : `${subject.points} points`}`;
  return `${what}: ${subject.reason}`;
}

/** Appeals of bans and warnings in the viewer's scope, open ones by default. */
export function AppealsPanel({ context, realm, page, basePath }: PanelProps) {
  const [status, setStatus] = useState<Status>("open");
  const query = api.thinkpagesForumMod.appeals.useQuery({ status, realm, page });
  const refresh = useModRefresh("appeals");
  const filter = useFilterChange(basePath, page);
  const rows = query.data?.rows ?? [];
  return (
    <ModPanel
      content="data"
      label="Appeals"
      toolbar={
        <SegmentedControl
          aria-label="Appeal status"
          size="sm"
          options={STATUSES}
          value={status}
          onValueChange={(next) => filter(() => setStatus(next))}
        />
      }
      query={query}
      rowCount={rows.length}
      emptyTitle={status === "open" ? "No open appeals" : "No appeals here"}
      paging={{ total: query.data?.total, perPage: MOD_ROWS_PER_PAGE, page, basePath }}
    >
      {rows.map((appeal) => (
        <AppealRow
          key={appeal.id}
          appeal={appeal}
          members={query.data?.authors}
          context={context}
          refresh={refresh}
        />
      ))}
    </ModPanel>
  );
}

interface AppealRowProps {
  appeal: Appeal;
  members: Members | undefined;
  context: ModContext;
  refresh: () => Promise<void>;
}

function AppealRow({ appeal, members, context, refresh }: AppealRowProps) {
  const [expanded, setExpanded] = useState(false);
  const long = appeal.body.length > LONG_BODY;
  return (
    <ModRow
      title={
        <>
          {memberName(members, appeal.userId)}
          {appeal.status === "open" ? null : <Badge>{DECIDED[appeal.status]}</Badge>}
        </>
      }
      meta={[
        subjectLine(appeal, context),
        appeal.subject ? `Issued by ${memberName(members, appeal.subject.issuedBy)}` : null,
        timeAgo(appeal.createdAt),
      ]}
      actions={<AppealActions appeal={appeal} refresh={refresh} />}
    >
      <p
        className={`text-callout text-label break-words whitespace-pre-line ${long && !expanded ? "line-clamp-3" : ""}`}
      >
        {appeal.body}
      </p>
      {long ? (
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
      {appeal.status !== "open" && appeal.reviewedBy ? (
        <p className="text-footnote text-label-secondary">
          {`Reviewed by ${memberName(members, appeal.reviewedBy)}`}
        </p>
      ) : null}
      {appeal.response ? (
        <p className="text-footnote text-label-secondary break-words">{`Response: ${appeal.response}`}</p>
      ) : null}
    </ModRow>
  );
}

/**
 * Uphold or overturn, each with a required response the member reads. The server says who may decide
 * (`canReview`): never the moderator who issued or raised the subject, nor the member themselves.
 */
function AppealActions({ appeal, refresh }: { appeal: Appeal; refresh: () => Promise<void> }) {
  const [deciding, setDeciding] = useState<Outcome | null>(null);
  const { mutateAsync: review } = api.thinkpagesForumMod.reviewAppeal.useMutation();
  if (appeal.status !== "open") return null;
  if (!appeal.canReview) {
    return <p className="text-footnote text-label-secondary">Another moderator must review this</p>;
  }
  const subject = appeal.subjectType ?? "decision";
  return (
    <>
      {(["upheld", "overturned"] as const).map((outcome) => (
        <Button
          key={outcome}
          size="sm"
          variant={outcome === "overturned" ? "default" : "secondary"}
          onClick={() => setDeciding(outcome)}
        >
          {VERB[outcome]}
        </Button>
      ))}
      {deciding ? (
        <NoteDialog
          title={`${VERB[deciding]} the ${subject}`}
          description={
            deciding === "upheld"
              ? `The ${subject} stands. The member reads your response.`
              : `The ${subject} ends now. The member reads your response.`
          }
          label="Response to the member"
          confirmLabel={VERB[deciding]}
          required
          max={RESPONSE_MAX}
          onConfirm={(response) =>
            review({ appealId: appeal.id, outcome: deciding, response: response ?? "" }).then(
              refresh
            )
          }
          onOpenChange={(next) => {
            if (!next) setDeciding(null);
          }}
        />
      ) : null}
    </>
  );
}
