"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Xmark } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { SearchField } from "~/components/ui/search-field";
import { MessagesUserSearchResults } from "~/components/messages/MessagesUserSearchResults";
import { MAX_FOUNDERS } from "~/lib/realms/realm-region";

interface Founder {
  userId: string;
  name: string;
}

/**
 * Site staff: the realm's founding members, credited in the realm header in this order. Anyone with an IxStates
 * account can be listed (found by nation name); listing them gives no power over the realm. Saves on its own.
 */
export function FoundersField({
  realmId,
  initial,
}: {
  realmId: string;
  initial: readonly Founder[];
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [founders, setFounders] = useState<Founder[]>([...initial]);
  const [query, setQuery] = useState("");
  const { data: users, isLoading } = api.messages.searchUsers.useQuery(
    { query },
    { enabled: query.length > 2 }
  );
  const save = api.realms.region.setFounders.useMutation({
    onSuccess: () => {
      notify.success("Founders saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the founders", error.message),
  });

  const add = (clerkUserId: string) => {
    const user = users?.find((u) => u.clerkUserId === clerkUserId);
    if (!user || founders.some((f) => f.userId === clerkUserId)) return;
    setFounders([
      ...founders,
      { userId: clerkUserId, name: user.country?.name ?? "Unnamed account" },
    ]);
    setQuery("");
  };
  const move = (from: number, to: number) => {
    const next = [...founders];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    setFounders(next);
  };
  const full = founders.length >= MAX_FOUNDERS;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="realm-founders-search">Founding members</Label>
      {founders.length > 0 && (
        <ol className="flex flex-col gap-1">
          {founders.map((founder, index) => (
            <li
              key={founder.userId}
              className="rounded-row bg-fill-3 flex items-center justify-between gap-2 p-2"
            >
              <span className="text-label text-body truncate">{founder.name}</span>
              <span className="flex shrink-0 gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move ${founder.name} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move ${founder.name} down`}
                  disabled={index === founders.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${founder.name}`}
                  onClick={() => setFounders(founders.filter((f) => f.userId !== founder.userId))}
                >
                  <Xmark aria-hidden="true" />
                </Button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {!full && (
        <>
          <SearchField
            id="realm-founders-search"
            placeholder="Search by nation name"
            value={query}
            onValueChange={setQuery}
          />
          {query.length > 0 && (
            <MessagesUserSearchResults
              query={query}
              users={users}
              isLoading={isLoading}
              emptyLabel="No one found"
              disabled={false}
              onPick={add}
            />
          )}
        </>
      )}
      <p className="text-label-secondary text-footnote">
        Credited in the realm header as Founders, in this order. Up to {MAX_FOUNDERS}. They get no
        powers over the realm. Only site staff can change them.
      </p>
      <div>
        <Button
          size="sm"
          variant="secondary"
          disabled={save.isPending}
          onClick={() => save.mutate({ realmId, userIds: founders.map((f) => f.userId) })}
        >
          Save founders
        </Button>
      </div>
    </div>
  );
}
