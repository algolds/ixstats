"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkSolid,
  Clock,
  DesignPencil,
  Globe,
  Link as LinkIcon,
  MoreHoriz,
  Printer,
  Wrench,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useUserCountry } from "~/hooks/useUserCountry";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";
import { useWikiContext } from "./WikiContext";

/** The country a wiki page is about, if it names one. */
interface WikiCountry {
  id?: string;
  name?: string | null;
}

export interface WikiPageToolsProps {
  /** The article title, as the stash and margin APIs key it. */
  title: string;
  isSignedIn: boolean;
  country?: WikiCountry | null;
  /** The article's own tools. Off for another wiki's page, which keeps only the country's actions. */
  articleTools?: boolean;
}

/** Stash state and toggle for one article. */
function useStashToggle(title: string, enabled: boolean) {
  const notify = useNotify();
  const utils = api.useUtils();
  const stashed = api.wikios.isStashed.useQuery(
    { pageTitle: title },
    { enabled: enabled && !!title, retry: false }
  ).data?.stashed;

  const readable = title.replace(/_/g, " ");
  const outcome = (done: string, failure: string) => ({
    onSuccess: () => {
      notify.success(done);
      void utils.wikios.isStashed.invalidate({ pageTitle: title });
      void utils.wikios.getStashes.invalidate();
      void utils.wikios.getArticleMarginData.invalidate({ articleTitle: title });
    },
    onError: (err: { message?: string }) => notify.error(err.message || failure),
  });
  const stash = api.wikios.stashPage.useMutation(
    outcome(`Saved "${readable}" to Stash`, "Failed to stash article")
  );
  const unstash = api.wikios.unstashPage.useMutation(
    outcome(`Removed "${readable}" from Stash`, "Failed to unstash article")
  );

  return {
    stashed: stashed ?? false,
    toggle: () => {
      if (stash.isPending || unstash.isPending) return;
      (stashed ? unstash : stash).mutate({ pageTitle: title });
    },
  };
}

function CountryActionsDialog({
  country,
  open,
  onClose,
}: {
  country: WikiCountry;
  open: boolean;
  onClose: () => void;
}) {
  const { country: myCountry, userProfile } = useUserCountry();
  return (
    <CountryActionsMenu
      targetCountryId={country.id ?? ""}
      targetCountryName={country.name ?? "Country"}
      viewerCountryId={userProfile?.countryId ?? undefined}
      isOpen={open}
      onClose={onClose}
      isOwnCountry={!!country.id && myCountry?.id === country.id}
    />
  );
}

/** The overflow menu: every page tool the WikiOS rail used to offer, plus the page's country actions. */
export function WikiPageTools({
  title,
  isSignedIn,
  country,
  articleTools = true,
}: WikiPageToolsProps) {
  const { isMarginOpen, toggleMargin, setActiveModal } = useWikiContext();
  const { stashed, toggle: toggleStash } = useStashToggle(title, isSignedIn && articleTools);
  const [countryOpen, setCountryOpen] = useState(false);

  if (!articleTools && !country) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Page tools">
            <MoreHoriz className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {articleTools && (
            <>
              <DropdownMenuItem onSelect={() => toggleMargin()}>
                <DesignPencil className="size-4" />
                {isMarginOpen ? "Hide margin" : "Show margin"}
                <kbd className="text-label-secondary text-footnote ml-auto tabular-nums">T</kbd>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setActiveModal("history")}>
                <Clock className="size-4" />
                Revision history
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setActiveModal("backlinks")}>
                <LinkIcon className="size-4" />
                What links here
              </DropdownMenuItem>
              {isSignedIn && (
                <DropdownMenuItem onSelect={toggleStash}>
                  {stashed ? <BookmarkSolid className="size-4" /> : <Bookmark className="size-4" />}
                  {stashed ? "Remove from Stash" : "Save to Stash"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => window.print()}>
                <Printer className="size-4" />
                Print
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={withBasePath("/util")}>
                  <Wrench className="size-4" />
                  Utilities and special pages
                </Link>
              </DropdownMenuItem>
            </>
          )}
          {articleTools && country && <DropdownMenuSeparator />}
          {country && (
            <DropdownMenuItem onSelect={() => setCountryOpen(true)}>
              <Globe className="size-4" />
              Country actions
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {country && (
        <CountryActionsDialog
          country={country}
          open={countryOpen}
          onClose={() => setCountryOpen(false)}
        />
      )}
    </>
  );
}
