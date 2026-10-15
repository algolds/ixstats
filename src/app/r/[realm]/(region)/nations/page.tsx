"use client";

import { use, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, type RouterOutputs } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useBulkFlags } from "~/hooks/useUnifiedFlags";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { orderNations } from "~/lib/realms/nation-order";
import { Badge } from "~/components/ui/badge";
import { ClaimNationButton } from "~/components/realms/ClaimNationButton";
import { ClaimableNations } from "../../_components/ClaimableNations";
import { LeaveRealmButton } from "../../_components/LeaveRealmButton";
import { MyClaims } from "../../_components/MyClaims";
import { PlayAsNation } from "../../_components/PlayAsNation";
import { MorphLabel } from "../../_components/MorphLabel";
import { NationsBrowser } from "../../_components/NationsBrowser";
import type { RealmNation } from "../../_components/NationsGrid";

type Realm = NonNullable<RouterOutputs["realms"]["getBySlug"]>;
type Stats = RouterOutputs["countries"]["getAll"]["countries"][number];

/** Card fields that stay `undefined` (never `null`) when the nation has no value. */
const OPTIONAL_FIELDS = [
  "landArea",
  "populationDensity",
  "gdpDensity",
  "adjustedGdpGrowth",
  "populationGrowthRate",
  "continent",
  "region",
  "governmentType",
  "leader",
  "religion",
  "lifeExpectancy",
  "literacyRate",
  "unemploymentRate",
  "inflationRate",
  "povertyRate",
  "totalDebtGDPRatio",
  "realGDPGrowthRate",
] as const;

/** A realm nation (claim state from the realm) with its card figures (from the country list). */
function toCard(c: Realm["countries"][number], s: Stats | undefined, flag?: string): RealmNation {
  const optional = Object.fromEntries(OPTIONAL_FIELDS.map((k) => [k, s?.[k] ?? undefined]));
  return {
    ...(optional as Partial<RealmNation>),
    id: c.id,
    name: c.name,
    slug: c.slug ?? c.id,
    claimed: c.claimed,
    mine: c.mine,
    flagUrl: normalizeFlagUrl(c.flag) || normalizeFlagUrl(flag) || undefined,
    currentPopulation: s?.currentPopulation || 0,
    currentGdpPerCapita: s?.currentGdpPerCapita || 0,
    currentTotalGdp: s?.currentTotalGdp || 0,
    economicTier: s?.economicTier || "Unknown",
    populationTier: s?.populationTier || "Unknown",
  };
}

const SOLID = "bg-surface text-label shadow-card";

/** A button on the card's photo sits on a solid chip so it reads over any flag. */
const onChip = (button: ReactNode) => (
  <span className="bg-surface rounded-control-sm shadow-card inline-flex">{button}</span>
);

/**
 * A card's corner: one button showing the nation's state that morphs into its action while the card is hovered
 * (Active → Leave realm, Yours → Play as, Unclaimed → Claim), or a badge when there is nothing to do (Pending
 * review, or Unclaimed while the viewer can't claim). Null on other players' nations.
 */
function nationCorner(
  nation: RealmNation,
  realm: Realm,
  { canClaim, pending, active }: { canClaim: boolean; pending: boolean; active: boolean }
) {
  const ids = { countryId: nation.id, countryName: nation.name };
  if (nation.mine && active)
    return onChip(
      <LeaveRealmButton
        {...ids}
        slug={realm.slug}
        realmName={realm.name}
        label={<MorphLabel idle="Active" action="Leave realm" />}
      />
    );
  if (nation.mine)
    return onChip(
      <PlayAsNation {...ids} active={false} label={<MorphLabel idle="Yours" action="Play as" />} />
    );
  if (nation.claimed) return null;
  if (!canClaim || pending)
    return <Badge className={SOLID}>{pending ? "Pending review" : "Unclaimed"}</Badge>;
  return onChip(
    <ClaimNationButton
      {...ids}
      realmSlug={realm.slug}
      label={<MorphLabel idle="Unclaimed" action="Claim" />}
    />
  );
}

/**
 * Every nation of the realm as the card grid (the viewer's own first, then shuffled per visit), with claim
 * state on each card; then the viewer's claims here and the claimable pages. This is the only nation list:
 * /countries redirects here.
 */
export default function RealmNationsPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const router = useRouter();
  const { data: realm, isLoading } = api.realms.getBySlug.useQuery({ slug });
  const { data: statsResult, isLoading: statsLoading } = api.countries.getAll.useQuery(
    { limit: 1000, realm: slug },
    { refetchOnWindowFocus: false, staleTime: 30_000 }
  );
  const { isSignedIn } = useAuth();
  // Shared with the region layout's header query: the rules a claim needs accepted.
  const { data: overview } = api.realms.region.overview.useQuery({ slug });
  const ownsHere = !!realm?.countries.some((c) => c.mine);
  const { data: profile } = api.users.getProfile.useQuery(undefined, { enabled: ownsHere });
  const { data: myClaims } = api.realms.myClaims.useQuery(
    { realmSlug: slug },
    { enabled: !!isSignedIn }
  );
  // Nations the viewer already asked for: shown as "Pending review" instead of Claim.
  const pending = useMemo(
    () =>
      new Set(
        (myClaims ?? []).flatMap((c) => (c.status === "pending" && c.country ? [c.country.id] : []))
      ),
    [myClaims]
  );
  const names = useMemo(() => realm?.countries.map((c) => c.name) ?? [], [realm]);
  const { flagUrls, isLoading: flagsLoading } = useBulkFlags(names);
  const [seed] = useState(Math.random);
  const nations = useMemo(() => {
    const stats = new Map(statsResult?.countries.map((s) => [s.id, s]));
    const cards = (realm?.countries ?? []).map((c) =>
      toCard(c, stats.get(c.id), flagUrls[c.name] ?? undefined)
    );
    return orderNations(cards, seed);
  }, [realm, statsResult, flagUrls, seed]);
  usePageTitle({ title: realm ? `${realm.name} · Nations` : "Nations" });

  if (isLoading || !realm)
    return <p className="text-label-secondary text-body">{isLoading ? "Loading nations…" : ""}</p>;

  return (
    <div className="flex flex-col gap-6">
      {realm.countries.length === 0 ? (
        <p className="text-label-secondary text-body">
          {realm.nationPages.length > 0
            ? "No nation has been founded yet. Claim one of the nation pages below."
            : "No nation has been founded yet."}
        </p>
      ) : (
        <NationsBrowser
          nations={nations}
          isLoading={statsLoading || flagsLoading}
          onCountryClick={(c) => router.push(`/countries/${c.slug ?? c.id}`)}
          viewerCountryId={profile?.countryId ?? undefined}
          corner={(nation) =>
            nationCorner(nation, realm, {
              canClaim: !!isSignedIn && realm.claimsOpen,
              pending: pending.has(nation.id),
              active: profile?.countryId === nation.id,
            })
          }
        />
      )}

      <MyClaims realmSlug={realm.slug} />

      {realm.claimsOpen && realm.nationPages.length > 0 && (
        <ClaimableNations
          realmSlug={realm.slug}
          pages={realm.nationPages}
          rules={overview?.rules ?? null}
        />
      )}
    </div>
  );
}
