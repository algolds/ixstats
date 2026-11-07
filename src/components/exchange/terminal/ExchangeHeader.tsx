"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { EXCHANGE_VERSION } from "~/lib/buildVersion";
import { EXCHANGE_PATHS } from "~/lib/exchange/routes";
import { ExchangeWordmark, Pill } from "./brand";

/** The wordmark, the realm being watched (`?realm=`) and the one main action. */
export function ExchangeHeader({ realmId }: { realmId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const realms = api.exchange.realms.useQuery(undefined, { staleTime: 5 * 60_000 });
  const setRealm = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("realm", next);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-baseline gap-2">
        <Link href={EXCHANGE_PATHS.front} aria-label="Exchange front page">
          <ExchangeWordmark />
        </Link>
        <span className="text-caption text-label-secondary tabular-nums">v{EXCHANGE_VERSION}</span>
      </span>
      <div className="flex items-center gap-2">
        {realms.data && realms.data.length > 1 && (
          <div className="w-40">
            <Select value={realmId} onValueChange={setRealm}>
              <SelectTrigger size="sm" aria-label="Realm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {realms.data.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Pill asChild>
          <Link href={`${EXCHANGE_PATHS.markets}?focus=search`}>Buy or sell</Link>
        </Pill>
      </div>
    </header>
  );
}
