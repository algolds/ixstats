"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Crown, Globe, UserCircle } from "iconoir-react";
import {
  REDUCED_MOTION_FADE,
  springGentle,
  springSmooth,
  tweenExit,
  tweenFast,
} from "~/lib/design/motion";
import { assetUrl } from "~/lib/base-path";
import { cn } from "~/lib/utils/cn";
import { isIxnaySlug } from "~/lib/realms/realm-ids";
import { ClaimNationButton } from "~/components/realms/ClaimNationButton";

const PILL =
  "text-footnote text-label bg-fill-4 inline-flex h-7 items-center gap-2 overflow-hidden rounded-full px-3 font-medium whitespace-nowrap";

export interface CountryIdentityStripProps {
  /** `logoUrl`: the realm's emblem (else its thumbnail); the globe icon shows without one. */
  realm?: { name: string; slug: string; logoUrl?: string | null } | null;
  /**
   * `avatarUrl`: the sovereign's Clerk profile picture (the person icon shows without one). `role`: their Clerk
   * role (`publicMetadata.role`), which colours the IxnayID pill's outline.
   */
  sovereign?: {
    username: string | null;
    roleName?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
  } | null;
  /** An unclaimed nation of a realm open to claims: "Claim this nation" beside "Unclaimed" for signed-in viewers. */
  claim?: { countryId: string; countryName: string } | null;
  className?: string;
}

/** The IxnayID pill's outline per Clerk role; a standard user (or none) has no outline. */
const ROLE_BORDER: Record<string, string> = {
  owner: "border-yellow/70",
  admin: "border-red/60",
  staff: "border-indigo/60",
  moderator: "border-teal/60",
  beta_tester: "border-green/60",
};

/** A pill's leading picture (realm logo, profile picture), or its icon when there is none. */
function PillImage({ src, round, fallback }: { src?: string | null; round?: boolean; fallback: ReactNode }) {
  const url = assetUrl(src);
  if (!url) return fallback;
  return (
    <img
      src={url}
      alt=""
      className={cn("-ml-1 size-5 shrink-0 object-cover", round ? "rounded-full" : "rounded-sm object-contain")}
    />
  );
}

/** Opening widens gently; closing settles a little quicker, as exits should. */
const OPEN = { width: springGentle, opacity: { ...tweenFast, duration: 0.24, delay: 0.04 } };
const CLOSE = { width: springSmooth, opacity: tweenExit };

/**
 * One link pill that morphs open on its own: on mouse hover or keyboard focus its detail widens from nothing
 * and fades in. The detail is always in the DOM (zero width when closed), so screen readers read it either way.
 * A touch just follows the link.
 */
function MorphPill({
  href,
  icon,
  label,
  detail,
  className,
  role,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  detail?: ReactNode;
  className?: string;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const hover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setOpen(next);
  };

  return (
    <Link
      href={href}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      data-role={role}
      className={cn(
        PILL,
        "hover:bg-fill-3 duration-fast ease-out-facet focus-visible:outline-tint transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        className
      )}
    >
      {icon}
      <span>{label}</span>
      {detail && (
        <motion.span
          data-state={open ? "open" : "closed"}
          className="text-label-secondary -ml-2 inline-flex overflow-hidden"
          initial={false}
          animate={{ width: open ? "auto" : 0, opacity: open ? 1 : 0 }}
          transition={reduceMotion ? REDUCED_MOTION_FADE : open ? OPEN : CLOSE}
        >
          <span className="inline-flex items-center gap-1 pl-2">{detail}</span>
        </motion.span>
      )}
    </Link>
  );
}

/**
 * CountryIdentityStrip — provenance for a nation: the realm it belongs to (→ `/r/[realm]`, with its logo) and the
 * IxnayID of the player who holds it (→ `/@handle`, with their Clerk picture and a role-coloured outline), or
 * "Unclaimed" (with "Claim this nation" when the realm takes claims). Each pill morphs open on its own to show
 * "Primary realm" or the sovereign's role. Pills on `fill-4`, so it sits on any opaque card.
 */
export function CountryIdentityStrip({ realm, sovereign, claim, className }: CountryIdentityStripProps) {
  const realmName = realm?.name || "Ixnay";
  const realmSlug = realm?.slug || "default";
  const isPrimary = isIxnaySlug(realmSlug);
  const handle = sovereign?.username?.replace(/^@/, "").trim() || null;
  const role = sovereign?.role ?? undefined;

  return (
    <nav aria-label="Realm and sovereign" className={cn("flex flex-wrap items-center gap-2", className)}>
      <MorphPill
        href={`/r/${realmSlug}`}
        icon={
          <PillImage
            src={realm?.logoUrl}
            fallback={<Globe aria-hidden className="text-label-secondary size-3.5" />}
          />
        }
        label={realmName}
        detail={isPrimary ? "Primary realm" : "Realm"}
      />
      {handle ? (
        <MorphPill
          href={`/@${handle}`}
          icon={
            <PillImage
              round
              src={sovereign?.avatarUrl}
              fallback={<UserCircle aria-hidden className="text-label-secondary size-3.5" />}
            />
          }
          label={`@${handle}`}
          detail={
            sovereign?.roleName && (
              <>
                <Crown aria-hidden className="size-3.5" />
                {sovereign.roleName}
              </>
            )
          }
          role={role}
          className={cn("border", (role && ROLE_BORDER[role]) || "border-transparent")}
        />
      ) : (
        // Ownership, not a username, decides "Claimed": a new player may have no handle yet.
        <span className={cn(PILL, "text-label-secondary")}>
          <UserCircle aria-hidden className="size-3.5" />
          {sovereign ? "Claimed" : "Unclaimed"}
        </span>
      )}
      {!sovereign && claim && !isPrimary && (
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
