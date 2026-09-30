"use client";
// src/app/(wiki-os)/util/block/page.tsx
// Special:Block — block a wiki username from editing.

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  AdminPage,
  ExpirySelect,
  FormField,
  RightGate,
} from "~/components/wiki-os/admin/AdminPage";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { withBasePath } from "~/lib/base-path";
import { expiryFromPreset, type ExpiryPreset } from "~/lib/wiki-os/page-admin-ui";

export default function BlockUserPage() {
  const router = useRouter();
  const notify = useNotify();
  const [username, setUsername] = useState(useSearchParams().get("user") ?? "");
  const [expiry, setExpiry] = useState<ExpiryPreset>("infinite");
  const [reason, setReason] = useState("");
  const [allowUserTalk, setAllowUserTalk] = useState(true);

  const block = api.wikios.blockUser.useMutation({
    onSuccess: (result) => {
      notify.success("User blocked", `${result.target} can no longer edit.`);
      router.push("/util/blocklist");
    },
    onError: (error) => notify.error("Block failed", error.message),
  });

  return (
    <AdminPage
      title="Block user"
      description="Stop a wiki account from editing. Blocking someone who is already blocked changes their block."
    >
      <RightGate right="block">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            block.mutate({
              target: { wikiUsername: username.trim() },
              expiresAt: expiryFromPreset(expiry),
              reason,
              allowUserTalk,
            });
          }}
        >
          <FormField label="Wiki username" htmlFor="block-user">
            <Input
              id="block-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Duration" htmlFor="block-expiry">
            <ExpirySelect
              id="block-expiry"
              value={expiry}
              onChange={(next) => next !== "keep" && setExpiry(next)}
            />
          </FormField>
          <FormField label="Reason" htmlFor="block-reason">
            <Input
              id="block-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <Label className="gap-2">
            <Checkbox
              checked={allowUserTalk}
              onCheckedChange={(value) => setAllowUserTalk(value === true)}
            />
            Let them edit their own user talk page
          </Label>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="destructive"
              disabled={!username.trim() || block.isPending}
            >
              {block.isPending ? "Blocking…" : "Block user"}
            </Button>
            <Link
              href={withBasePath("/util/blocklist")}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Current blocks
            </Link>
          </div>
        </form>
      </RightGate>
    </AdminPage>
  );
}
