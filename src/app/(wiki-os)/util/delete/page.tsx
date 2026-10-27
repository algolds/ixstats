"use client";
// src/app/(wiki-os)/util/delete/page.tsx
// Special:Delete — hide a page from readers. Its history is kept and an administrator can undelete it.

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

export default function DeletePagePage() {
  const title = readableTitle(useSearchParams().get("title") ?? "");
  const router = useRouter();
  const notify = useNotify();
  const [reason, setReason] = useState("");

  const remove = api.wikios.deletePage.useMutation({
    onSuccess: (result) => {
      notify.success("Page deleted", `"${result.title}" is hidden from readers.`);
      router.push("/util/log?type=delete");
    },
    onError: (error) => notify.error("Delete failed", error.message),
  });

  return (
    <AdminPage
      title="Delete page"
      description="Readers will see the page as missing. Its history is kept, and it can be undeleted."
    >
      <RightGate right="delete">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            remove.mutate({ title, reason });
          }}
        >
          <FormField label="Page" htmlFor="delete-title">
            <Input id="delete-title" value={title} readOnly />
          </FormField>
          <FormField label="Reason" htmlFor="delete-reason">
            <Input
              id="delete-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <Button type="submit" variant="destructive" disabled={!title || remove.isPending}>
            {remove.isPending ? "Deleting…" : "Delete page"}
          </Button>
        </form>
      </RightGate>
    </AdminPage>
  );
}
