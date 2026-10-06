"use client";
// src/app/(wiki-os)/util/move/page.tsx
// Special:MovePage — rename a page, leaving a redirect and bringing its talk page along.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  AdminPage,
  FormField,
  RightGate,
  readableTitle,
} from "~/components/wiki-os/admin/AdminPage";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function MovePagePage() {
  const from = readableTitle(useSearchParams().get("title") ?? "");
  const router = useRouter();
  const notify = useNotify();
  const [to, setTo] = useState(from);
  const [reason, setReason] = useState("");
  const [leaveRedirect, setLeaveRedirect] = useState(true);
  const [moveTalk, setMoveTalk] = useState(true);

  const move = api.wikios.movePage.useMutation({
    onSuccess: (result) => {
      notify.success("Page moved", `"${result.from}" is now "${result.to}".`);
      router.push(`/wiki/${encodeURIComponent(result.to.replace(/ /g, "_"))}`);
    },
    onError: (error) => notify.error("Move failed", error.message),
  });

  return (
    <AdminPage
      title="Move page"
      description="Rename a page. Its history moves with it, and the old title can redirect to the new one."
    >
      <RightGate right="move">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            move.mutate({ from, to: to.trim(), reason, leaveRedirect, moveTalk });
          }}
        >
          <FormField label="Current title" htmlFor="move-from">
            <Input id="move-from" value={from} readOnly />
          </FormField>
          <FormField label="New title" htmlFor="move-to">
            <Input id="move-to" value={to} onChange={(e) => setTo(e.target.value)} required />
          </FormField>
          <FormField label="Reason" htmlFor="move-reason">
            <Input
              id="move-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <div className="space-y-2">
            <Label className="gap-2">
              <Checkbox
                checked={leaveRedirect}
                onCheckedChange={(v) => setLeaveRedirect(v === true)}
              />
              Leave a redirect behind
            </Label>
            <Label className="gap-2">
              <Checkbox checked={moveTalk} onCheckedChange={(v) => setMoveTalk(v === true)} />
              Move the talk page too, if there is one
            </Label>
          </div>
          <Button type="submit" disabled={!from || !to.trim() || move.isPending}>
            {move.isPending ? "Moving…" : "Move page"}
          </Button>
        </form>
      </RightGate>
    </AdminPage>
  );
}
