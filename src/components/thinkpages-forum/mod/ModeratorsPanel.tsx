"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { timeAgo } from "~/lib/format/compact";
import { categoryLocator } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { MemberLookup } from "./MemberLookup";
import { NoteDialog } from "./NoteDialog";
import { categoryLabel } from "../BanDialog";
import { memberName, ModPanel, ModRow, useModRefresh, type PanelProps } from "./ModRow";

/** Site admins (M19): pick a category, see its moderators, appoint or remove them. */
export function ModeratorsPanel({ context }: PanelProps) {
  const notify = useNotify();
  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null);
  const [categoryId, setCategoryId] = useState(context.categories[0]?.id ?? "");
  const category = context.categories.find((c) => c.id === categoryId);
  const query = api.thinkpagesForumMod.categoryModerators.useQuery(
    category ? categoryLocator(category) : skipToken
  );
  const { mutateAsync: setModerator, isPending } =
    api.thinkpagesForumMod.setCategoryModerator.useMutation();
  const refresh = useModRefresh();
  const rows = query.data?.rows ?? [];

  if (!category) {
    return <p className="text-callout text-label-secondary">There are no categories yet.</p>;
  }

  const change = (userId: string, grant: boolean) =>
    setModerator({ ...categoryLocator(category), userId, grant }).then(refresh);

  return (
    <>
      <ModPanel
        content="data"
        label="Category moderators"
        toolbar={
          <>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger aria-label="Category" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {context.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {categoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <MemberLookup
              action="Add"
              onFound={(member) =>
                change(member.id, true).then(() =>
                  notify.success(`${member.name} now moderates ${category.name}`)
                )
              }
            />
          </>
        }
        query={query}
        rowCount={rows.length}
        emptyTitle="No category moderators"
      >
        {rows.map((row) => (
          <ModRow
            key={row.userId}
            title={row.name}
            meta={[
              `Appointed by ${memberName(query.data?.authors, row.grantedBy)}`,
              timeAgo(row.createdAt),
            ]}
            actions={
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Remove ${row.name} as a moderator of ${category.name}`}
                disabled={isPending}
                onClick={() => setRemoving({ userId: row.userId, name: row.name })}
              >
                Remove
              </Button>
            }
          />
        ))}
      </ModPanel>
      {removing ? (
        <NoteDialog
          title="Remove this moderator"
          description={`${removing.name} no longer moderates ${category.name}.`}
          confirmLabel="Remove moderator"
          destructive
          withNote={false}
          onConfirm={() =>
            change(removing.userId, false).then(() =>
              notify.success(`${removing.name} no longer moderates ${category.name}`)
            )
          }
          onOpenChange={(next) => {
            if (!next) setRemoving(null);
          }}
        />
      ) : null}
    </>
  );
}
