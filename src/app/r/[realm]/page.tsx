"use client";

import { use } from "react";
import Link from "next/link";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { Globe, Settings, Map, Group as Users, Crown } from "iconoir-react";
import { usePageTitle } from "~/hooks/usePageTitle";

export default function RealmHubPage({
  params,
}: {
  params: Promise<{ realm: string }>;
}) {
  const { realm } = use(params);
  const formattedRealmName = realm.charAt(0).toUpperCase() + realm.slice(1).replace(/-/g, " ");

  const { organization: currentOrg } = useOrganization();
  const { userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const matchingOrg =
    currentOrg?.slug === realm || currentOrg?.id === realm
      ? currentOrg
      : userMemberships?.data?.find(
          (m) => m.organization.slug === realm || m.organization.id === realm
        )?.organization;

  const realmLogo = matchingOrg?.imageUrl;

  usePageTitle({
    title: `${formattedRealmName} · Realm`,
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col p-4 md:p-8">
      {/* Realm Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-6 md:p-8 backdrop-blur-xl shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-accent text-foreground shadow-md overflow-hidden">
              {realmLogo ? (
                <img
                  src={realmLogo}
                  alt={formattedRealmName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Globe className="h-8 w-8" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{formattedRealmName}</h1>
                <span className="rounded-md border border-border bg-accent px-2 py-0.5 text-[10px] font-bold text-foreground">
                  Realm Instance
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Simulation realm on the IxStates engine.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/r/${realm}/settings`}
              className="facet-interactive flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted active:scale-[0.98]"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Settings</span>
            </Link>
            <Link
              href={`/maps?realm=${realm}`}
              className="facet-interactive flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 active:scale-[0.98]"
            >
              <Map className="h-4 w-4" />
              <span>View Map</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Realm Sub-Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-foreground">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Sovereign Nations</h3>
              <p className="text-xs text-muted-foreground">Active states in this realm</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">World Members</h3>
              <p className="text-xs text-muted-foreground">Active worldbuilders & players</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-foreground">
              <Map className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Atlas Mesh</h3>
              <p className="text-xs text-muted-foreground">100k cell Voronoi terrain</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
