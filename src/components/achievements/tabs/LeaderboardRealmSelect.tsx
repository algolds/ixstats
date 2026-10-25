"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { selectedRankingRealm } from "~/lib/realms/realm-scope-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/**
 * Picks the realm the leaderboards rank (`?realm=`). Realms run at their own speeds, so nations are only ranked
 * against their own realm's; the viewer's realm is shown until they pick another.
 */
export function LeaderboardRealmSelect({ realmParam }: { realmParam: string | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const viewerRealmId = useViewerRealmId();
  const { data: realms } = api.realms.directory.useQuery(undefined, { staleTime: 5 * 60_000 });
  if (!realms || realms.length < 2) return null;
  const selected = selectedRankingRealm(realms, realmParam, viewerRealmId);

  const pick = (slug: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("realm", slug);
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <Select value={selected?.slug} onValueChange={pick}>
      <SelectTrigger size="sm" className="w-full sm:w-48" aria-label="Realm">
        <SelectValue placeholder="Realm" />
      </SelectTrigger>
      <SelectContent>
        {realms.map((realm) => (
          <SelectItem key={realm.id} value={realm.slug}>
            {realm.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
