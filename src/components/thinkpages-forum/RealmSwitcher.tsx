"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { forumHomeHref } from "~/lib/thinkpages-forum/links";

interface RealmSwitcherProps {
  realms: ReadonlyArray<{ slug: string; name: string }>;
  /** The open realm's slug. */
  value: string;
}

/** Picks the realm section the forum home shows; the choice lives in `?realm=` so it survives reloads. */
export function RealmSwitcher({ realms, value }: RealmSwitcherProps) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(slug) => router.replace(forumHomeHref(slug))}>
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
