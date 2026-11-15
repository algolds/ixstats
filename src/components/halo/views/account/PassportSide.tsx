"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EditPencil, LogOut } from "iconoir-react";
import { api } from "~/trpc/react";
import { SignOutButton, useUser } from "~/context/auth-context";
import { Button, focusRing } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { NationSwitcher } from "~/components/navigation/NationSwitcher";
import { PassportCompactFace } from "~/components/passport/document/PassportFrontFace";
import { useUserCosmetics } from "~/hooks/usePublicCosmetics";
import { listDrafts, type WikiEditorDraft } from "~/lib/wiki-os/editor/draft-store";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import { handleProfileHref } from "~/lib/thinkpages-forum/links";
import { timeAgo } from "~/lib/format/compact";
import { cn } from "~/lib/utils";
import { HaloWell } from "../shared/HaloViewParts";
import { useHaloMaterial, WELL_MATERIAL } from "../../halo-material";

/** The base role every player has; the Passport leaves it unlabelled, and so does Halo. */
const BASE_ROLE_LEVEL = 100;
const MAX_DRAFTS = 3;

const SHORTCUTS = [
  ["Vault", "/vault"],
  ["Messages", "/messages"],
  ["Settings", "/settings"],
] as const;

export interface PassportSideProps {
  /** Closes Halo (links navigate by themselves). */
  onClose: () => void;
  /** Closes Halo, then routes to `path`. */
  onNavigate: (path: string) => void;
}

function draftPath(draft: WikiEditorDraft): string {
  const reader = wikiReaderPath(draft.title.replace(/_/g, " "), parseWikiSource(draft.source));
  return `${reader}${reader.includes("?") ? "&" : "?"}action=edit`;
}

/** The newest wiki drafts saved in this browser for the signed-in reader. */
function useWikiDrafts(owner: string | null | undefined): WikiEditorDraft[] {
  const [drafts, setDrafts] = useState<WikiEditorDraft[]>([]);
  useEffect(() => {
    try {
      // oxlint-disable-next-line react/set-state-in-effect -- listDrafts claims unowned drafts (writes storage), so it cannot run in render
      setDrafts(listDrafts(owner).slice(0, MAX_DRAFTS));
    } catch {
      // Storage unavailable: no drafts to show.
    }
  }, [owner]);
  return drafts;
}

/**
 * Halo's Passport side: the IxStates Passport front face in a compact size (one link to the full Passport), the
 * role, Play as (switch nation, grouped by realm), wiki drafts, account shortcuts and Sign out.
 */
export function PassportSide({ onClose, onNavigate }: PassportSideProps) {
  const { user } = useUser();
  const userId = user?.id;
  const { data: card, isLoading } = api.ixnayid.getMyPassportCard.useQuery();
  const { data: profile } = api.users.getProfile.useQuery(undefined, { enabled: !!userId });
  const cosmetics = useUserCosmetics(userId);
  const drafts = useWikiDrafts(userId);
  const material = useHaloMaterial();

  const role = profile?.role;
  const roleBadge = role && role.level < BASE_ROLE_LEVEL ? role.displayName : null;
  const joined = card?.preview
    ? card.joinedAt
      ? new Date(card.joinedAt).toISOString()
      : null
    : null;
  const displayName = user?.fullName || user?.username || (card?.preview ? card.displayName : "");
  const avatarUrl = user?.imageUrl || (card?.preview ? card.avatarUrl : null);

  return (
    <div className="space-y-2">
      {isLoading || !card?.preview ? (
        <Skeleton className="rounded-row h-36 w-full" />
      ) : (
        <Link
          href={handleProfileHref(card.handle)}
          onClick={onClose}
          aria-label={`Your Passport, @${card.handle}`}
          className={cn(
            WELL_MATERIAL[material],
            "rounded-row relative isolate block overflow-hidden",
            focusRing
          )}
        >
          <PassportCompactFace
            handle={card.handle}
            displayName={displayName}
            avatarUrl={avatarUrl}
            cosmetics={cosmetics}
            roleBadge={roleBadge}
            signature={card.signature}
            lorewards={
              card.lorewards
                ? { totalScore: card.lorewards.score, rank: card.lorewards.rank }
                : null
            }
            realmCount={card.realmCount}
            nationCount={card.nationCount}
            joinedAt={joined}
          />
        </Link>
      )}

      {/* Renders nothing below two nations, so it carries its own well rather than sitting in an empty one. */}
      <NationSwitcher className={cn(WELL_MATERIAL[material], "rounded-row p-2")} />

      {drafts.length > 0 && (
        <HaloWell aria-labelledby="halo-wiki-drafts">
          <h3 id="halo-wiki-drafts" className="text-subhead text-label-secondary px-1 pb-1">
            Wiki drafts
          </h3>
          <ul>
            {drafts.map((draft) => (
              <li key={`${draft.source}:${draft.title}`}>
                <button
                  type="button"
                  onClick={() => onNavigate(draftPath(draft))}
                  className={cn(
                    "hover:bg-fill-4 rounded-control flex min-h-11 w-full items-center gap-3 px-2 text-left transition-colors",
                    focusRing
                  )}
                >
                  <EditPencil aria-hidden className="text-label-secondary size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="text-body text-label block truncate">
                      {draft.title.replace(/_/g, " ")}
                    </span>
                    <span className="text-footnote text-label-secondary">
                      Edited {timeAgo(draft.savedAt)}
                    </span>
                  </span>
                  <span className="text-footnote text-tint shrink-0 font-medium">Resume</span>
                </button>
              </li>
            ))}
          </ul>
        </HaloWell>
      )}

      <div className="grid grid-cols-3 gap-2">
        {SHORTCUTS.map(([label, path]) => (
          <Button
            key={path}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onNavigate(path)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex justify-start pt-1">
        <SignOutButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-label-secondary hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut aria-hidden />
            Sign out
          </Button>
        </SignOutButton>
      </div>
    </div>
  );
}
