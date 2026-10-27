"use client";
// src/app/(wiki-os)/util/undelete/page.tsx
// Special:Undelete — publish a deleted page again.

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
import { Input } from "~/components/ui/input";

export default function UndeletePagePage() {
  const router = useRouter();
  const notify = useNotify();
  const [title, setTitle] = useState(readableTitle(useSearchParams().get("title") ?? ""));
  const [reason, setReason] = useState("");

  const restore = api.wikios.undeletePage.useMutation({
    onSuccess: (result) => {
      notify.success("Page restored", `"${result.title}" is published again.`);
      router.push(`/wiki/${encodeURIComponent(result.title.replace(/ /g, "_"))}`);
    },
    onError: (error) => notify.error("Undelete failed", error.message),
  });

  return (
    <AdminPage title="Undelete page" description="Publish a deleted page again, with its history.">
      <RightGate right="undelete">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            restore.mutate({ title: title.trim(), reason });
          }}
        >
          <FormField label="Page" htmlFor="undelete-title">
            <Input
              id="undelete-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Reason" htmlFor="undelete-reason">
            <Input
              id="undelete-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <Button type="submit" disabled={!title.trim() || restore.isPending}>
            {restore.isPending ? "Restoring…" : "Undelete page"}
          </Button>
        </form>
      </RightGate>
    </AdminPage>
  );
}
