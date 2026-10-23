"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsRow } from "~/app/settings/_components/primitives";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Signal } from "~/components/ui/signal";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";

type NameClaim = RouterOutputs["ixnayid"]["listMyNameClaims"][number];

const STATUS: Record<NameClaim["status"], { variant: BadgeVariant; label: string }> = {
  PENDING: { variant: "secondary", label: "Waiting for review" },
  APPROVED: { variant: "success", label: "Approved" },
  REJECTED: { variant: "destructive", label: "Not approved" },
  REVOKED: { variant: "outline", label: "Removed" },
};

/** A pending or approved name still counts, so its visibility can change. */
const isLive = (claim: NameClaim) => claim.status === "PENDING" || claim.status === "APPROVED";

/** The player's old IxWiki names: each claim's state, a switch to show it, and the form to ask for another. */
export function WikiNameClaims() {
  const notify = useNotify();
  const utils = api.useUtils();
  const claims = api.ixnayid.listMyNameClaims.useQuery();
  const [name, setName] = useState("");
  const [evidence, setEvidence] = useState("");

  const refresh = () => void utils.ixnayid.listMyNameClaims.invalidate();
  const request = api.ixnayid.requestNameClaim.useMutation({
    onSuccess: () => {
      setName("");
      setEvidence("");
      refresh();
    },
    onError: (err) => notify.error(err.message),
  });
  const visibility = api.ixnayid.setNameClaimVisibility.useMutation({
    onSuccess: refresh,
    onError: (err) => notify.error(err.message),
  });

  const list = claims.data ?? [];
  const anyHidden = list.some((claim) => isLive(claim) && !claim.visible);
  const draft = name.trim();

  return (
    <>
      {anyHidden && (
        <div className="p-4">
          <Signal tone="info" title="Private until you confirm">
            You had wiki attribution off. Turn on each name you want shown on your passport and your
            wiki pages.
          </Signal>
        </div>
      )}
      {list.map((claim) => (
        <SettingsRow key={claim.id} label={claim.name} description={claim.decisionNote}>
          <Badge variant={STATUS[claim.status].variant}>{STATUS[claim.status].label}</Badge>
          {isLive(claim) && (
            <Switch
              aria-label={`Show ${claim.name} on my passport`}
              checked={claim.visible}
              disabled={visibility.isPending}
              onCheckedChange={(visible) => visibility.mutate({ claimId: claim.id, visible })}
            />
          )}
        </SettingsRow>
      ))}
      <form
        className="flex flex-col gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft) request.mutate({ name: draft, evidence: evidence.trim() || null });
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Old IxWiki name"
          placeholder="Wiki user name"
          maxLength={85}
          disabled={request.isPending}
        />
        <Textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          aria-label="How we can tell it is yours"
          placeholder="Optional: your alts, renames or pages you made"
          maxLength={1000}
          disabled={request.isPending}
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="self-end"
          disabled={!draft || request.isPending}
        >
          {request.isPending ? "Asking..." : "Ask to add"}
        </Button>
      </form>
    </>
  );
}
