"use client";

import Link from "next/link";
import { Globe, UserCircle, ShieldCheck, ArrowRight, Crown } from "iconoir-react";
import { cn, createUrl } from "~/lib/utils";

/**
 * CountryIdentityStrip — Variant A (inline rail).
 *
 * Sits between the country name and the economic stat badges. Answers
 * provenance: which realm, whose IxnayID, and where the passport lives.
 * Links realm → /r/[realm] per spec. Separated from badges intentionally:
 * realm owns land, owner owns realm, badges quantify the realm.
 *
 * Apple §12: translucent floating layer, not opaque bar. Content scrolls
 * under; material weight encodes hierarchy. §14: reduced-motion/transparency
 * handled via CSS media queries. §15: mono rail uses higher weight + spacing
 * for vibrancy over blur.
 */
export interface CountryIdentityStripProps {
  hasImage: boolean;
  realm?: { id: string; name: string; slug: string } | null;
  sovereignUser?: { username: string | null; roleName?: string | null } | null;
  className?: string;
}

function realmHref(slug: string) {
  return createUrl(`/r/${slug}`);
}

function passportHref(username: string | null | undefined, fallbackSlug: string) {
  const handle = (username || fallbackSlug || "").replace(/^@/, "").trim();
  if (!handle) return createUrl("/id");
  return createUrl(`/id/@${handle}`);
}

export function CountryIdentityStrip({
  hasImage,
  realm,
  sovereignUser,
  className,
}: CountryIdentityStripProps) {
  const realmName = realm?.name || "IxWorld";
  const realmSlug = realm?.slug || "default";
  const isDefaultRealm = realmSlug === "default" || realmSlug === "ixworld";
  const ownerHandle = sovereignUser?.username?.replace(/^@/, "") || null;
  const fallbackSlugForPassport =
    (realmSlug !== "default" ? realmSlug : "") || (typeof window !== "undefined" ? "" : "");
  // Keep link stable even without owner — passport resolves via country slug fallback at layout level.
  const showOwner = Boolean(ownerHandle);

  return (
    <nav
      aria-label="Realm and identity"
      className={cn(
        // Layout: inline flex, wraps, gap, Apple tactile response on interactive children
        "flex flex-wrap items-center gap-1.5",
        // Material: hairline rail — rounded-full pill group, not a full-width bar
        // Over image: dark scrim with blur+saturate (§12). Over gradient: muted glass.
        className
      )}
    >
      {/* Realm pill — links to /r/[realm] (Variant A, §7 anchored origin: trigger is the text itself) */}
      <Link
        href={realmHref(realmSlug)}
        aria-label={`View realm ${realmName}`}
        data-cuelume-press="soft"
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all duration-150 ease-out active:scale-[0.97]",
          hasImage
            ? "border-white/15 bg-black/35 text-white backdrop-blur-md hover:border-white/25 hover:bg-black/45 supports-[backdrop-filter]:bg-black/30"
            : "border-border bg-card/60 text-foreground hover:bg-card hover:border-foreground/15 backdrop-blur-xl"
        )}
        style={hasImage ? { backdropFilter: "blur(12px) saturate(180%)" } : undefined}
      >
        <Globe className="h-3.5 w-3.5 shrink-0 opacity-80 group-hover:opacity-100" />
        <span className="font-bold tracking-wider">{realmName}</span>
        <span
          className={cn(
            "hidden rounded-full px-1.5 py-0 text-[9px] font-bold tracking-widest uppercase sm:inline",
            hasImage ? "bg-white/15 text-white/90" : "bg-foreground/8 text-muted-foreground"
          )}
        >
          {isDefaultRealm ? "Primary" : realmSlug}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 opacity-50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:opacity-80" />
      </Link>

      {/* Bullet separator — vibrancy-aware (§12: avoid stacking light-on-light, so opacity tuned) */}
      <span
        aria-hidden="true"
        className={cn(
          "text-[10px] font-bold select-none",
          hasImage ? "text-white/35" : "text-muted-foreground/40"
        )}
      >
        ·
      </span>

      {/* IxnayID passport pill — links to /id/@handle */}
      {showOwner ? (
        <Link
          href={passportHref(ownerHandle, fallbackSlugForPassport)}
          aria-label={`View IxnayID passport for @${ownerHandle} in ${realmName}`}
          data-cuelume-press="soft"
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all duration-150 ease-out active:scale-[0.97]",
            hasImage
              ? "border-white/15 bg-black/35 text-white backdrop-blur-md hover:border-white/25 hover:bg-black/45"
              : "border-border bg-card/60 text-foreground hover:bg-card hover:border-foreground/15 backdrop-blur-xl"
          )}
          style={hasImage ? { backdropFilter: "blur(12px) saturate(180%)" } : undefined}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/12 dark:bg-white/10">
            <UserCircle className="h-3 w-3" />
          </span>
          <span className="font-mono text-[11px] font-bold">@{ownerHandle}</span>
          {sovereignUser?.roleName && (
            <span
              className={cn(
                "hidden items-center gap-1 rounded-full px-1.5 py-0 text-[9px] font-bold tracking-widest uppercase sm:inline-flex",
                hasImage ? "bg-white/12 text-white/85" : "bg-foreground/8 text-muted-foreground"
              )}
            >
              <Crown className="h-2.5 w-2.5" />
              {sovereignUser.roleName}
            </span>
          )}
          <ShieldCheck className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
        </Link>
      ) : (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
            hasImage
              ? "border-white/10 bg-black/25 text-white/70 backdrop-blur-md"
              : "border-border bg-card/50 text-muted-foreground"
          )}
        >
          <UserCircle className="h-3.5 w-3.5 opacity-60" />
          <span className="font-mono text-[10px] tracking-wider uppercase">Unclaimed</span>
        </span>
      )}

      {/* Subtle realm provenance hint — not a link, reduces to tooltip on mobile */}
      <span
        className={cn(
          "hidden text-[10px] font-medium tracking-wide md:inline",
          hasImage ? "text-white/45" : "text-muted-foreground/60"
        )}
        title="Realm — sovereign simulation instance. IxWorld is the private default."
      >
        Sovereign instance
      </span>
    </nav>
  );
}
