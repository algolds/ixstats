import Link from "next/link";
import { Crown, Globe, UserCircle } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { ClaimNationButton } from "~/components/realms/ClaimNationButton";

const PILL =
  "text-footnote text-label bg-fill-4 rounded-full inline-flex h-7 items-center gap-2 px-3 font-medium";
const LINK_PILL = cn(
  PILL,
  "hover:bg-fill-3 focus-visible:outline-tint transition-colors duration-fast ease-out-facet focus-visible:outline-2 focus-visible:outline-offset-2"
);

export interface CountryIdentityStripProps {
  realm?: { name: string; slug: string } | null;
  sovereign?: { username: string | null; roleName?: string | null } | null;
  /** An unclaimed nation of a realm open to claims: "Claim this nation" beside "Unclaimed" for signed-in viewers. */
  claim?: { countryId: string; countryName: string } | null;
  className?: string;
}

/**
 * CountryIdentityStrip — provenance for a nation: the realm it belongs to (→ `/r/[realm]`) and
 * the IxnayID of the player who holds it (→ `/@handle`), or "Unclaimed" (with "Claim this nation" when the
 * realm takes claims). Pills on `fill-4`, so it sits on any opaque card.
 */
export function CountryIdentityStrip({
  realm,
  sovereign,
  claim,
  className,
}: CountryIdentityStripProps) {
  const realmName = realm?.name || "IxWorld";
  const realmSlug = realm?.slug || "default";
  const isPrimary = realmSlug === "default" || realmSlug === "ixworld";
  const handle = sovereign?.username?.replace(/^@/, "").trim() || null;

  return (
    <nav
      aria-label="Realm and sovereign"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <Link href={`/r/${realmSlug}`} className={LINK_PILL}>
        <Globe aria-hidden className="text-label-secondary size-3.5" />
        <span>{realmName}</span>
        <span className="text-label-secondary">{isPrimary ? "Primary realm" : "Realm"}</span>
      </Link>
      {handle ? (
        <Link
          href={`/@${handle}`}
          className={LINK_PILL}
          aria-label={`IxnayID passport of @${handle}${sovereign?.roleName ? `, ${sovereign.roleName}` : ""}`}
        >
          <UserCircle aria-hidden className="text-label-secondary size-3.5" />
          <span>@{handle}</span>
          {sovereign?.roleName && (
            <span className="text-label-secondary inline-flex items-center gap-1">
              <Crown aria-hidden className="size-3.5" />
              {sovereign.roleName}
            </span>
          )}
        </Link>
      ) : (
        <span className={cn(PILL, "text-label-secondary")}>
          <UserCircle aria-hidden className="size-3.5" />
          Unclaimed
        </span>
      )}
      {!handle && claim && !isPrimary && (
        <ClaimNationButton
          realmSlug={realmSlug}
          countryId={claim.countryId}
          countryName={claim.countryName}
          label="Claim this nation"
        />
      )}
    </nav>
  );
}
