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
import { api } from "~/trpc/react";
import { MemberLookup } from "./MemberLookup";
import {
  categoryLabel,
  memberName,
  ModPanel,
  ModRow,
  useModRefresh,
  type ModContext,
  type PanelProps,
} from "./ModRow";

type Category = ModContext["categories"][number];

/** A category as the router locates it: its key, and its realm's slug for a realm category. */
const locatorOf = (category: Category) => ({
  key: category.key,
  ...(category.realm ? { realm: category.realm.slug } : {}),
});

/** Site admins (M19): pick a category, see its moderators, appoint or remove them. */
export function ModeratorsPanel({ context }: PanelProps) {
  const notify = useNotify();
  const [categoryId, setCategoryId] = useState(context.categories[0]?.id ?? "");
  const category = context.categories.find((c) => c.id === categoryId);
  const query = api.thinkpagesForumMod.categoryModerators.useQuery(
    category ? locatorOf(category) : skipToken
  );
  const { mutateAsync: setModerator, isPending } =
    api.thinkpagesForumMod.setCategoryModerator.useMutation();
  const refresh = useModRefresh("categoryModerators");
  const rows = query.data?.rows ?? [];

  if (!category) {
    return <p className="text-callout text-label-secondary">There are no categories yet.</p>;
  }

  const change = (userId: string, grant: boolean) =>
    setModerator({ ...locatorOf(category), userId, grant }).then(refresh);

  const remove = (userId: string, name: string) => {
    change(userId, false)
      .then(() => notify.success(`${name} no longer moderates ${category.name}`))
      .catch((e: Error) => notify.error("Could not remove this moderator", e.message));
  };

  return (
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
              disabled={isPending}
              onClick={() => remove(row.userId, row.name)}
            >
              Remove
            </Button>
          }
        />
      ))}
    </ModPanel>
  );
}
