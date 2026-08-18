"use client";

import { useState } from "react";
import Link from "next/link";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { BookOpen, Clock, Globe, Map as MapIcon, Users } from "lucide-react";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { createUrl } from "~/lib/utils";

export function WikiAuthorPopover({ username }: { username: string }) {
  const [open, setOpen] = useState(false);

  // Only fetch when the card is opened — avoids N+1 queries on page load
  const { data: author, isLoading } = api.users.resolveWikiAuthor.useQuery(
    { wikiUsername: username },
    { enabled: open, staleTime: 60_000 }
  );

  const wikiUserUrl = createUrl(`/wiki/user/${username}`);
  const wikiContribsUrl = createUrl(`/wiki/contributions/${username}`);

  return (
    <HoverCardPrimitive.Root open={open} onOpenChange={setOpen} openDelay={300} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>
        <button className="text-foreground/80 hover:text-foreground cursor-pointer font-medium underline decoration-dotted underline-offset-2 transition-colors">
          {username}
        </button>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          side="top"
          align="start"
          sideOffset={4}
          className="bg-popover border-border/50 animate-in fade-in-0 zoom-in-95 z-50 w-56 rounded-xl border p-3 shadow-lg"
        >
          {isLoading ? (
            <div className="space-y-2">
              <div className="bg-muted h-4 w-24 animate-pulse rounded" />
              <div className="bg-muted/60 h-3 w-32 animate-pulse rounded" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2">
                {author?.country?.flag ? (
                  <UnifiedCountryFlag
                    showTooltip={false}
                    countryName={author.country.name ?? ""}
                    size="sm"
                    className="shrink-0"
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-teal-500/10">
                    <Users className="h-3 w-3 text-teal-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-foreground truncate text-xs font-semibold">{username}</p>
                  {author?.country && (
                    <p className="text-muted-foreground truncate text-[10px]">
                      {author.country.name}
                      {author.country.continent ? ` · ${author.country.continent}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Country info badge */}
              {author?.country?.economicTier && (
                <div className="text-muted-foreground text-[10px]">
                  <span className="text-foreground/70 font-medium">
                    {author.country.economicTier}
                  </span>
                  {author.country.leader && <span> · Led by {author.country.leader}</span>}
                </div>
              )}

              {/* Quick links */}
              <div className="border-border/30 flex flex-col gap-0.5 border-t pt-1.5">
                <Link
                  href={wikiUserUrl}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors"
                >
                  <BookOpen className="h-3 w-3 shrink-0 text-teal-400" />
                  Wiki User Page
                </Link>
                <Link
                  href={wikiContribsUrl}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors"
                >
                  <Clock className="h-3 w-3 shrink-0 text-teal-400" />
                  Contributions
                </Link>
                {author?.country?.slug && (
                  <>
                    <Link
                      href={createUrl(`/countries/${author.country.slug}`)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors"
                    >
                      <Globe className="h-3 w-3 shrink-0 text-blue-400" />
                      Country Page
                    </Link>
                    <Link
                      href={createUrl(`/maps?country=${author.country.id}`)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors"
                    >
                      <MapIcon className="h-3 w-3 shrink-0 text-emerald-400" />
                      View on Map
                    </Link>
                  </>
                )}
                {!author?.country && !isLoading && (
                  <span className="text-muted-foreground/50 px-1.5 py-0.5 text-[9px] italic">
                    No linked IxStats country
                  </span>
                )}
              </div>
            </div>
          )}
          <HoverCardPrimitive.Arrow className="fill-popover" />
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
