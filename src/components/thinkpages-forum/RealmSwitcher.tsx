"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { hubHref } from "~/lib/thinkpages-forum/links";

interface RealmSwitcherProps {
  realms: ReadonlyArray<{ slug: string; name: string }>;
  /** The open realm's slug. */
  value: string;
  /** Where a picked realm opens; its Hub board when omitted. */
  hrefFor?: (slug: string) => string;
}

/** Picks a realm to read: opens that realm's Hub board, or the page `hrefFor` names. */
export function RealmSwitcher({ realms, value, hrefFor = hubHref }: RealmSwitcherProps) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(slug) => router.push(hrefFor(slug))}>
      <SelectTrigger size="sm" aria-label="Realm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {realms.map((realm) => (
          <SelectItem key={realm.slug} value={realm.slug}>
            {realm.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
