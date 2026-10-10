"use client";

import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import { timeAgo } from "~/lib/format/compact";
import { formatBanDate } from "~/lib/thinkpages-forum/moderation-policy";
import { MOD_ROWS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api, type RouterOutputs } from "~/trpc/react";
import { WarnDialog } from "../WarnDialog";
import { MemberLookup } from "./MemberLookup";
import { categoryLabel } from "../BanDialog";
import {
  AppealBadge,
  memberName,
  ModPanel,
  ModRow,
  useFilterChange,
  useModRefresh,
  type Members,
  type ModContext,
  type PanelProps,
} from "./ModRow";
import { NoteDialog } from "./NoteDialog";

type Warning = RouterOutputs["thinkpagesForumMod"]["warnings"]["rows"][number];

const points = (n: number) => (n === 1 ? "1 point" : `${n} points`);

function isActive(warning: Warning, now: number): boolean {
  return warning.revokedAt === null && warning.expiresAt.getTime() > now;
}

function stateOf(warning: Warning, members: Members | undefined, now: number): string {
  if (warning.revokedAt) {
    return warning.revokedBy ? `Revoked by ${memberName(members, warning.revokedBy)}` : "Revoked";
  }
  const date = formatBanDate(warning.expiresAt);
  return warning.expiresAt.getTime() > now ? `Expires ${date}` : `Expired ${date}`;
}

/** Where the warning was given: a category the viewer moderates, or the whole forum. */
function placeOf(warning: Warning, context: ModContext): string {
  if (warning.categoryId === null) return "The whole forum";
  const category = context.categories.find((c) => c.id === warning.categoryId);
  return category ? categoryLabel(category) : "A category";
}

/**
 * Warnings in the viewer's scope, active ones by default. Site admins also warn a member by handle, with no post or
 * thread (a sitewide warning, which only they may give).
 */
export function WarningsPanel({ context, realm, page, basePath }: PanelProps) {
  const switchId = useId();
  const [includeEnded, setIncludeEnded] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const query = api.thinkpagesForumMod.warnings.useQuery({
    activeOnly: !includeEnded,
    realm,
    page,
  });
  const refresh = useModRefresh();
  const filter = useFilterChange(basePath, page);
  const rows = query.data?.rows ?? [];
  const now = Date.now();

  return (
    <>
      <ModPanel
        label="Warnings"
        column="Warning"
        toolbar={
          <>
            {context.isSiteAdmin ? (
              <MemberLookup action="Warn a member" onFound={(member) => setWarning(member.id)} />
            ) : null}
            <div className="flex items-center gap-2">
              <Switch
                id={switchId}
                checked={includeEnded}
                onCheckedChange={(next) => filter(() => setIncludeEnded(next))}
              />
              <Label htmlFor={switchId}>Include expired and revoked</Label>
            </div>
          </>
        }
        query={query}
        rowCount={rows.length}
        emptyTitle={includeEnded ? "No warnings" : "No active warnings"}
        paging={{ total: query.data?.total, perPage: MOD_ROWS_PER_PAGE, page, basePath }}
      >
        {rows.map((w) => (
          <WarningRow
            key={w.id}
            warning={w}
            members={query.data?.authors}
            context={context}
            canRevoke={isActive(w, now) && (w.categoryId !== null || context.isSiteAdmin)}
            stateLine={stateOf(w, query.data?.authors, now)}
            refresh={refresh}
          />
        ))}
      </ModPanel>
      {warning ? (
        <WarnDialog
          userId={warning}
          target={null}
          open
          onOpenChange={(next) => {
            if (!next) setWarning(null);
          }}
          onDone={() => void refresh()}
        />
      ) : null}
    </>
  );
}

interface WarningRowProps {
  warning: Warning;
  members: Members | undefined;
  context: ModContext;
  canRevoke: boolean;
  stateLine: string;
  refresh: () => Promise<void>;
}

function WarningRow({ warning, members, context, canRevoke, stateLine, refresh }: WarningRowProps) {
  const notify = useNotify();
  const [revoking, setRevoking] = useState(false);
  const { mutateAsync: revoke } = api.thinkpagesForumMod.revokeWarning.useMutation();
  const member = memberName(members, warning.userId);
  return (
    <ModRow
      title={
        <>
          {member}
          <AppealBadge status={warning.appealStatus} />
        </>
      }
      meta={[
        points(warning.points),
        placeOf(warning, context),
        `Issued by ${memberName(members, warning.issuedBy)}`,
        stateLine,
      ]}
      when={timeAgo(warning.createdAt)}
      actions={
        canRevoke ? (
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Revoke the warning for ${member}`}
            onClick={() => setRevoking(true)}
          >
            Revoke
          </Button>
        ) : null
      }
    >
      <p className="text-callout text-label break-words">{warning.reason}</p>
      {revoking ? (
        <NoteDialog
          title="Revoke this warning"
          description="Its points stop counting now, and an automatic ban they brought is shortened or lifted."
          confirmLabel="Revoke warning"
          onConfirm={(note) =>
            revoke({ warningId: warning.id, ...(note ? { note } : {}) }).then(() => {
              notify.success("Warning revoked");
              void refresh();
            })
          }
          onOpenChange={setRevoking}
        />
      ) : null}
    </ModRow>
  );
}
