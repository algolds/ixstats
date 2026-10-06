"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  HoverCardArrow,
} from "~/components/ui/hover-card";
import { OpenBook as BookOpen, Clock, Globe, Map as MapIcon, Group as Users } from "iconoir-react";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { createUrl } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";

export function WikiAuthorPopover({ username }: { username: string }) {
  const [open, setOpen] = useState(false);

  // Only fetch when the card is opened — avoids N+1 queries on page load
  const { data: author, isLoading } = api.users.resolveWikiAuthor.useQuery(
    { wikiUsername: username },
    { enabled: open, staleTime: 60_000 }
  );

  const wikiUserUrl = createUrl(getWikiProfilePath(username));
  const wikiContribsUrl = createUrl(`/util/contributions/${username}`);
  const country = author?.country;
  const links = [
    { href: wikiUserUrl, icon: BookOpen, label: "Wiki user page" },
    { href: wikiContribsUrl, icon: Clock, label: "Contributions" },
    ...(country?.slug
      ? [
          { href: createUrl(`/countries/${country.slug}`), icon: Globe, label: "Country page" },
          { href: createUrl(`/maps?country=${country.id}`), icon: MapIcon, label: "View on map" },
        ]
      : []),
  ];

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="text-label-secondary hover:text-label focus-visible:outline-tint rounded-control-sm cursor-pointer font-medium underline decoration-dotted underline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {username}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" sideOffset={4} className="w-56 p-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="rounded-control-sm h-4 w-24" />
            <Skeleton className="rounded-control-sm h-3 w-32" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {author?.country?.flag ? (
                <UnifiedCountryFlag
                  showTooltip={false}
                  countryName={author.country.name ?? ""}
                  size="sm"
                  className="shrink-0"
                />
              ) : (
                <div className="bg-fill-3 rounded-control-sm flex size-6 shrink-0 items-center justify-center">
                  <Users aria-hidden className="text-label-secondary size-3.5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-label text-headline truncate">{username}</p>
                {author?.country && (
                  <p className="text-label-secondary text-footnote truncate">
                    {author.country.name}
                    {author.country.continent ? ` · ${author.country.continent}` : ""}
                  </p>
                )}
              </div>
            </div>

            {author?.country?.economicTier && (
              <div className="text-label-secondary text-footnote">
                <span className="font-medium">{author.country.economicTier}</span>
                {author.country.leader && <span> · Led by {author.country.leader}</span>}
              </div>
            )}

            <div className="border-separator flex flex-col gap-0.5 border-t pt-2">
              {links.map(({ href, icon: Icon, label }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-label-secondary hover:text-label hover:bg-fill-4 rounded-control-sm text-footnote flex items-center gap-2 px-2 py-1 transition-colors"
                >
                  <Icon aria-hidden className="size-3.5 shrink-0" />
                  {label}
                </Link>
              ))}
              {!author?.country && !isLoading && (
                <span className="text-label-secondary text-footnote px-2 py-0.5">
                  No linked IxStats country
                </span>
              )}
            </div>
          </div>
        )}
        <HoverCardArrow className="fill-surface-elevated" />
      </HoverCardContent>
    </HoverCard>
  );
}
