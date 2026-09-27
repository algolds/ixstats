"use client";
// src/components/wiki-os/reader/WatchButton.tsx
// Watch/Unwatch toggle for an article; watched pages feed the watchlist at /util/watchlist.

import { Eye, EyeClosed } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { api } from "~/trpc/react";

export function WatchButton({ title }: { title: string }) {
  const { isSignedIn } = useWikiAuth();
  const pageTitle = title.replace(/_/g, " ");
  const utils = api.useUtils();

  const { data: isWatched = false } = api.wikios.isPageWatched.useQuery(
    { pageTitle },
    { enabled: isSignedIn, retry: false, staleTime: 60_000 }
  );

  // Flip the button immediately; the refetch on settle restores the truth if the call fails.
  const toggleOptions = (watched: boolean) => ({
    onMutate: () => {
      utils.wikios.isPageWatched.setData({ pageTitle }, watched);
    },
    onSettled: () => utils.wikios.isPageWatched.invalidate({ pageTitle }),
  });
  const watch = api.wikios.watchPage.useMutation(toggleOptions(true));
  const unwatch = api.wikios.unwatchPage.useMutation(toggleOptions(false));

  if (!isSignedIn) return null;

  const Icon = isWatched ? EyeClosed : Eye;
  const handleClick = () => {
    if (watch.isPending || unwatch.isPending) return;
    if (isWatched) unwatch.mutate({ pageTitle });
    else watch.mutate({ pageTitle });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={handleClick}
      title={isWatched ? "Remove from your watchlist" : "Add to your watchlist"}
      className="border-border/60 bg-background/60 text-muted-foreground hover:text-foreground gap-1.5 rounded-lg backdrop-blur-md"
    >
      <Icon className="h-3.5 w-3.5" />
      {isWatched ? "Unwatch" : "Watch"}
    </Button>
  );
}
