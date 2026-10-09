"use client";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { timeAgo } from "~/lib/format/compact";
import { formatBanDate } from "~/lib/thinkpages-forum/moderation-policy";
import { MOD_ROWS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { useNotify } from "~/hooks/useNotify";
import { api, type RouterOutputs } from "~/trpc/react";
import { BanDialog, contextBanScopes } from "../BanDialog";
import { MemberLookup } from "./MemberLookup";
import {
  AppealBadge,
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

type Ban = RouterOutputs["thinkpagesForumMod"]["bans"]["rows"][number];
type Shown = "active" | "ended";

const SHOWN = [
  { value: "active", label: "Active" },
  { value: "ended", label: "Lifted and expired" },
] as const;

function isLive(ban: Ban, now: number): boolean {
  return ban.liftedAt === null && (ban.expiresAt === null || ban.expiresAt.getTime() > now);
}

function lengthOf(ban: Ban, members: Members | undefined): string {
  if (ban.liftedAt) {
    return ban.liftedBy ? `Lifted by ${memberName(members, ban.liftedBy)}` : "Lifted";
  }
  return ban.expiresAt ? `Until ${formatBanDate(ban.expiresAt)}` : "Permanent";
}

/** Bans in the viewer's scope, live ones by default, and a way to ban a member found by handle. */
export function BansPanel({ context, realm, page, basePath }: PanelProps) {
  const [shown, setShown] = useState<Shown>("active");
  const [banning, setBanning] = useState<string | null>(null);
  const query = api.thinkpagesForumMod.bans.useQuery({ active: shown === "active", realm, page });
  const refresh = useModRefresh();
  const filter = useFilterChange(basePath, page);
  const rows = query.data?.rows ?? [];
  const now = Date.now();

  return (
    <>
      <ModPanel
        content="data"
        label="Bans"
        toolbar={
          <>
            <MemberLookup action="Ban a member" onFound={(member) => setBanning(member.id)} />
            <SegmentedControl
              aria-label="Bans shown"
              size="sm"
              options={SHOWN}
              value={shown}
              onValueChange={(next) => filter(() => setShown(next))}
            />
          </>
        }
        query={query}
        rowCount={rows.length}
        emptyTitle={shown === "active" ? "No active bans" : "No lifted or expired bans"}
        paging={{ total: query.data?.total, perPage: MOD_ROWS_PER_PAGE, page, basePath }}
      >
        {rows.map((ban) => (
          <BanRow
            key={ban.id}
            ban={ban}
            members={query.data?.authors}
            context={context}
            canLift={isLive(ban, now) && (ban.scope !== "site" || context.isSiteAdmin)}
            refresh={refresh}
          />
        ))}
      </ModPanel>
      {banning ? (
        <BanDialog
          userId={banning}
          scopes={contextBanScopes(context)}
          open
          onOpenChange={(next) => {
            if (!next) setBanning(null);
          }}
          onDone={() => void refresh()}
        />
      ) : null}
    </>
  );
}

interface BanRowProps {
  ban: Ban;
  members: Members | undefined;
  context: ModContext;
  canLift: boolean;
  refresh: () => Promise<void>;
}

function BanRow({ ban, members, context, canLift, refresh }: BanRowProps) {
  const notify = useNotify();
  const [lifting, setLifting] = useState(false);
  const { mutateAsync: lift } = api.thinkpagesForumMod.liftBan.useMutation();
  const member = memberName(members, ban.userId);
  return (
    <ModRow
      title={
        <>
          {member}
          {ban.auto ? <Badge>Automatic</Badge> : null}
          <AppealBadge status={ban.appealStatus} />
        </>
      }
      meta={[
        placeName(context, ban.scope, ban.scopeId),
        lengthOf(ban, members),
        `Issued by ${memberName(members, ban.issuedBy)}`,
        timeAgo(ban.createdAt),
      ]}
      actions={
        canLift ? (
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Lift the ban on ${member}`}
            onClick={() => setLifting(true)}
          >
            Lift
          </Button>
        ) : null
      }
    >
      <p className="text-callout text-label break-words">{ban.reason}</p>
      {lifting ? (
        <NoteDialog
          title="Lift this ban"
          description="They can post again where it applied. They are told it was lifted."
          confirmLabel="Lift ban"
          onConfirm={(note) =>
            lift({ banId: ban.id, ...(note ? { note } : {}) }).then(() => {
              notify.success("Ban lifted");
              void refresh();
            })
          }
          onOpenChange={setLifting}
        />
      ) : null}
    </ModRow>
  );
}
