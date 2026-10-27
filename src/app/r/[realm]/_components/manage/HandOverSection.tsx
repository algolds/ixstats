"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SearchField } from "~/components/ui/search-field";
import { ManageSection, type RealmManage } from "./ManageSection";

interface Successor {
  userId: string;
  label: string;
}

/**
 * The founder hands the realm to a player who owns a nation in it or is one of its officers. They become the
 * founder; the current founder loses the founder's powers unless they stay on as an officer. Confirmed by typing
 * the realm's slug.
 */
export function HandOverSection({ slug, manage }: { slug: string; manage: RealmManage }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Successor | null>(null);
  const [keep, setKeep] = useState(true);
  const [typed, setTyped] = useState("");
  const { data: candidates } = api.realms.region.handOverCandidates.useQuery(
    { slug, query },
    { enabled: picked === null }
  );
  const handOver = api.realms.region.handOver.useMutation({
    onSuccess: () => {
      notify.success(`${picked?.label ?? "The new founder"} now founds ${manage.realm.name}`);
      setPicked(null);
      setTyped("");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not hand the realm over", error.message),
  });

  const officers: Successor[] = manage.officers.map((o) => ({
    userId: o.userId,
    label: `${o.name} (${o.title})`,
  }));
  const nationOwners: Successor[] = (candidates ?? [])
    .filter((c) => !officers.some((o) => o.userId === c.userId))
    .map((c) => ({ userId: c.userId, label: c.nation }));
  const pickList = (title: string, people: Successor[]) =>
    people.length > 0 && (
      <div className="flex flex-col gap-1">
        <p className="text-label-secondary text-footnote">{title}</p>
        <ul className="flex max-h-40 flex-col overflow-y-auto">
          {people.map((person) => (
            <li key={person.userId}>
              <button
                type="button"
                onClick={() => setPicked(person)}
                className="hover:bg-fill-3 rounded-row text-label text-body w-full p-2 text-left"
              >
                {person.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <ManageSection
      id="handover"
      title="Hand over"
      description={`Make another player the founder of ${manage.realm.name}: an officer, or a player who owns a nation here. They get every founder power, and you lose them unless you stay on as an officer.`}
    >
      <div className="flex flex-col gap-4">
        {picked ? (
          <div className="bg-fill-4 rounded-row flex items-center justify-between gap-2 p-4">
            <span className="text-label text-body">New founder: {picked.label}</span>
            <Button size="xs" variant="ghost" onClick={() => setPicked(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pickList("Officers", officers)}
            <SearchField
              size="sm"
              value={query}
              onValueChange={setQuery}
              placeholder="Find a nation of the realm"
              aria-label="Find the new founder's nation"
            />
            {pickList("Nation owners", nationOwners)}
            {candidates?.length === 0 && (
              <p className="text-label-secondary text-footnote">No nation owner matches.</p>
            )}
          </div>
        )}
        <label htmlFor="handover-keep" className="text-label text-footnote flex items-center gap-2">
          <Checkbox
            id="handover-keep"
            checked={keep}
            onCheckedChange={(checked) => setKeep(checked === true)}
          />
          Keep previous owner as officer (you stay on with every officer power)
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="handover-slug">Type the realm slug ({slug}) to confirm</Label>
          <Input
            id="handover-slug"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={slug}
            className="font-mono"
          />
        </div>
        <div>
          <Button
            size="sm"
            variant="destructive"
            disabled={!picked || typed.trim() !== slug || handOver.isPending}
            onClick={() =>
              picked &&
              handOver.mutate({
                slug,
                newOwnerId: picked.userId,
                confirmSlug: typed,
                keepPreviousAsOfficer: keep,
              })
            }
          >
            Hand over realm
          </Button>
        </div>
      </div>
    </ManageSection>
  );
}
