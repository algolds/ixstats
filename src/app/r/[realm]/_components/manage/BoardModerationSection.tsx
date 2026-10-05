"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { BoardRestriction } from "~/lib/realms/realm-region";
import { ManageSection, type RealmManage } from "./ManageSection";

const FOREVER = "lifted";
const DURATIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: FOREVER, label: "Until lifted" },
];

/**
 * Board moderation: mute (no posts) or ban (off the board, chat included) a nation. Removing a nation from
 * the realm is not possible here.
 */
export function BoardModerationSection({ slug, manage }: { slug: string; manage: RealmManage }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data: hub } = api.realms.getBySlug.useQuery({ slug });
  const [countryId, setCountryId] = useState("");
  const [kind, setKind] = useState<BoardRestriction>("mute");
  const [duration, setDuration] = useState("7");
  const [reason, setReason] = useState("");
  const refresh = () => {
    void utils.realms.region.invalidate();
    void utils.realms.getBoard.invalidate({ slug });
  };
  const restrict = api.realms.region.restrictBoardNation.useMutation({
    onSuccess: () => {
      notify.success(kind === "ban" ? "Nation banned from the board" : "Nation muted");
      setCountryId("");
      setReason("");
      refresh();
    },
    onError: (error) => notify.error("Could not restrict", error.message),
  });
  const lift = api.realms.region.liftBoardRestriction.useMutation({
    onSuccess: () => {
      notify.success("Restriction lifted");
      refresh();
    },
    onError: (error) => notify.error("Could not lift", error.message),
  });
  const restricted = new Set(manage.boardRestrictions.map((r) => r.countryId));
  const nations = (hub?.countries ?? []).filter((c) => c.claimed && !restricted.has(c.id));

  return (
    <ManageSection
      id="board"
      title="Board moderation"
      description="A muted nation can read but not post; a banned nation leaves the board and its chat. Nobody can be removed from the realm itself."
    >
      <div className="flex flex-col gap-4">
        {manage.boardRestrictions.length === 0 ? (
          <p className="text-label-secondary text-body">No nation is muted or banned.</p>
        ) : (
          <ul className="divide-separator flex flex-col divide-y">
            {manage.boardRestrictions.map((r) => (
              <li
                key={r.countryId}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-label text-body flex items-center gap-2">
                    {r.nation?.name ?? "Unknown nation"}
                    <Badge variant={r.kind === "ban" ? "destructive" : "warning"}>
                      {r.kind === "ban" ? "Banned" : "Muted"}
                    </Badge>
                  </p>
                  <p className="text-label-secondary text-footnote">
                    {r.until ? `Until ${new Date(r.until).toLocaleDateString()}` : "Until lifted"}
                    {r.reason && ` · ${r.reason}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={lift.isPending}
                  onClick={() => lift.mutate({ slug, countryId: r.countryId })}
                >
                  Lift
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!manage.archived && (
          <div className="bg-fill-4 rounded-row grid gap-3 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-label text-footnote font-medium" id="restrict-nation">
                Nation
              </span>
              <Select value={countryId} onValueChange={setCountryId}>
                <SelectTrigger aria-labelledby="restrict-nation">
                  <SelectValue placeholder="Choose a nation" />
                </SelectTrigger>
                <SelectContent>
                  {nations.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-label text-footnote font-medium" id="restrict-kind">
                Restriction
              </span>
              <Select value={kind} onValueChange={(v) => setKind(v as BoardRestriction)}>
                <SelectTrigger aria-labelledby="restrict-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mute">Mute (can read, can't post)</SelectItem>
                  <SelectItem value="ban">Ban (off the board and chat)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-label text-footnote font-medium" id="restrict-duration">
                For
              </span>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger aria-labelledby="restrict-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="restrict-reason">Reason (shown to the nation)</Label>
              <Input
                id="restrict-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                size="sm"
                variant={kind === "ban" ? "destructive" : "default"}
                disabled={!countryId || restrict.isPending}
                onClick={() =>
                  restrict.mutate({
                    slug,
                    countryId,
                    kind,
                    reason: reason.trim() || undefined,
                    days: duration === FOREVER ? undefined : Number(duration),
                  })
                }
              >
                {kind === "ban" ? "Ban from the board" : "Mute on the board"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ManageSection>
  );
}
