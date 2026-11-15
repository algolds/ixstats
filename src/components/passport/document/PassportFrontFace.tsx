"use client";

import { CountryLink } from "~/components/shared/country-actions/CountryLink";
import React, { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CosmeticChatBadge } from "~/components/vault/CosmeticChatBadge";
import { assetUrl } from "~/lib/base-path";
import { REALM_ROLE_LABEL } from "~/lib/passport/passport-labels";
import type { PublicCosmetics } from "~/lib/vault/public-cosmetics";
import { PassportGuilloche } from "./PassportGuilloche";
import { PassportMasthead, PassportMastheadBrand } from "./PassportMasthead";
import { PassportPortrait } from "./PassportPortrait";
import { PassportStatRow } from "./PassportStatRow";

/** The primary nation's realm row, as `getPassport` returns it. */
export interface PassportFaceNation {
  /** Realm name and slug. */
  name: string;
  slug: string;
  role: "founder" | "officer" | "member";
  country: { name: string; slug: string; flagUrl: string | null };
}

/** The slice of the `getPassport` payload the front face reads. */
export interface PassportFaceData {
  handle: string;
  online: boolean;
  realmCount: number;
  nationCount: number;
  primaryNation: PassportFaceNation | null;
  account: { createdAt: string | null; signature: string | null };
  wiki: { lorewards: { totalScore: number; rank: number | null } | null };
  thinkpages: { bio: string | null };
}

interface PassportFrontFaceProps {
  data: PassportFaceData;
  displayName: string;
  avatarUrl: string | null;
  cosmetics: PublicCosmetics | null;
  isOwner: boolean;
  viewerSignedIn: boolean;
  onEdit: () => void;
  editButtonRef?: React.Ref<HTMLButtonElement>;
  onOpenLorewards: () => void;
}

const LINK = "hover:underline underline-offset-2";

/** Flag, nation, realm and the holder's realm role (a plain member is not labelled). */
function NationLine({ nation }: { nation: PassportFaceNation }) {
  const flag = assetUrl(nation.country.flagUrl);
  const role = REALM_ROLE_LABEL[nation.role];
  return (
    <p
      data-testid="passport-nation-line"
      className="text-callout text-label-secondary flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      {flag && (
        <img
          src={flag}
          alt=""
          className="ring-separator h-4 w-6 shrink-0 rounded-xs object-cover ring-1"
          loading="lazy"
          decoding="async"
        />
      )}
      <CountryLink
        country={{ slug: nation.country.slug, name: nation.country.name.replace(/_/g, " ") }}
        className={`text-label font-medium ${LINK}`}
      >
        {nation.country.name.replace(/_/g, " ")}
      </CountryLink>
      <span aria-hidden>·</span>
      <Link href={`/r/${encodeURIComponent(nation.slug)}`} className={LINK}>
        {nation.name}
      </Link>
      {role && (
        <>
          <span aria-hidden>·</span>
          <span>{role}</span>
        </>
      )}
    </p>
  );
}

/** The `@handle`; pressing it copies the handle. */
function HandleChip({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`@${handle}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permission denied or insecure context): nothing copied.
    }
  }, [handle]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      aria-label={copied ? "Handle copied" : `Copy handle @${handle}`}
      className="text-label-secondary -ml-3"
    >
      <span>@{handle}</span>
      {copied ? (
        <Check aria-hidden className="text-success size-3.5" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
    </Button>
  );
}

/**
 * The passport's identity page: masthead, portrait and signature, name, handle, the primary nation
 * line, the three facts and the ThinkPages bio, over the guilloché. Unknown facts are left out.
 */
export const PassportFrontFace = React.memo(function PassportFrontFace({
  data,
  displayName,
  avatarUrl,
  cosmetics,
  isOwner,
  viewerSignedIn,
  onEdit,
  editButtonRef,
  onOpenLorewards,
}: PassportFrontFaceProps) {
  const { handle, primaryNation, account } = data;
  const bio = data.thinkpages.bio?.trim() || null;

  return (
    <div className="rounded-t-card relative isolate overflow-hidden">
      <PassportGuilloche />
      <div className="relative space-y-6 p-5 sm:p-7">
        <PassportMasthead
          handle={handle}
          isOwner={isOwner}
          viewerSignedIn={viewerSignedIn}
          onEdit={onEdit}
          editButtonRef={editButtonRef}
        />

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="flex shrink-0 flex-col items-start gap-3">
            <PassportPortrait
              displayName={displayName}
              avatarUrl={avatarUrl}
              cosmetics={cosmetics}
            />
            {account.signature && (
              <p className="text-title-3 text-label border-separator w-38 truncate border-b pb-1 font-serif italic select-none sm:w-44">
                {account.signature}
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-5 sm:pt-1">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-label text-title-1">{displayName}</h2>
                <CosmeticChatBadge badge={cosmetics?.chatBadge} className="size-5" />
                {/* Shown only when the holder allows Online status. */}
                {data.online && <Badge variant="success">Online</Badge>}
              </div>
              <HandleChip handle={handle} />
              {primaryNation && <NationLine nation={primaryNation} />}
            </div>

            <PassportStatRow
              lorewards={data.wiki.lorewards}
              realmCount={data.realmCount}
              nationCount={data.nationCount}
              joinedAt={account.createdAt}
              onOpenLorewards={onOpenLorewards}
            />
          </div>
        </div>

        {bio && (
          <p
            className="text-footnote text-label-secondary border-separator truncate border-t pt-4"
            title={bio}
          >
            {bio}
          </p>
        )}
      </div>
    </div>
  );
});

export interface PassportCompactFaceProps {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  cosmetics: PublicCosmetics | null;
  /** Platform role display name when above the unlabelled base Member role. */
  roleBadge?: string | null;
  signature: string | null;
  lorewards: { totalScore: number; rank: number | null } | null;
  realmCount: number;
  nationCount: number;
  joinedAt: string | null;
}

/**
 * Compact static Passport front face (Halo's Passport side). Shares the guilloché, masthead brand,
 * portrait cosmetics, signature and stat row with `PassportFrontFace`, with no interactive children
 * so the whole card can be one link to the holder's Passport.
 */
export const PassportCompactFace = React.memo(function PassportCompactFace({
  handle,
  displayName,
  avatarUrl,
  cosmetics,
  roleBadge,
  signature,
  lorewards,
  realmCount,
  nationCount,
  joinedAt,
}: PassportCompactFaceProps) {
  return (
    <>
      <PassportGuilloche />
      <div className="relative space-y-3 p-3">
        <PassportMastheadBrand size="compact" />
        <div className="flex items-center gap-3">
          <PassportPortrait
            displayName={displayName}
            avatarUrl={avatarUrl}
            cosmetics={cosmetics}
            size="compact"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-headline text-label truncate">{displayName}</span>
              <CosmeticChatBadge badge={cosmetics?.chatBadge} className="size-4" />
              {roleBadge && <Badge variant="secondary">{roleBadge}</Badge>}
            </div>
            <p className="text-footnote text-label-secondary truncate">@{handle}</p>
            {signature && (
              <p className="text-callout text-label truncate font-serif italic select-none">
                {signature}
              </p>
            )}
          </div>
        </div>
        <PassportStatRow
          size="compact"
          lorewards={lorewards}
          realmCount={realmCount}
          nationCount={nationCount}
          joinedAt={joinedAt}
        />
      </div>
    </>
  );
});
