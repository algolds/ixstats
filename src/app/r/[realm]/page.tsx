"use client";

import { use } from "react";
import Link from "next/link";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { Globe, Settings, Map, Group as Users, Crown } from "iconoir-react";
import { usePageTitle } from "~/hooks/usePageTitle";

export default function RealmHubPage({ params }: { params: Promise<{ realm: string }> }) {
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
      <div className="border-border bg-card/70 relative overflow-hidden rounded-2xl border p-6 shadow-xs backdrop-blur-xl md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="border-border bg-accent text-foreground flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-md">
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
                <h1 className="text-foreground text-2xl font-bold tracking-tight">
                  {formattedRealmName}
                </h1>
                <span className="border-border bg-accent text-foreground rounded-md border px-2 py-0.5 text-[10px] font-bold">
                  Realm Instance
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Simulation realm on the IxStates engine.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/r/${realm}/settings`}
              className="facet-interactive border-border bg-card text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold active:scale-[0.98]"
            >
              <Settings className="text-muted-foreground h-4 w-4" />
              <span>Settings</span>
            </Link>
            <Link
              href={`/maps?realm=${realm}`}
              className="facet-interactive bg-primary text-primary-foreground flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.98]"
            >
              <Map className="h-4 w-4" />
              <span>View Map</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Realm Sub-Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="border-border bg-card/50 rounded-2xl border p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="bg-accent text-foreground flex h-10 w-10 items-center justify-center rounded-xl">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-bold">Sovereign Nations</h3>
              <p className="text-muted-foreground text-xs">Active states in this realm</p>
            </div>
          </div>
        </div>

        <div className="border-border bg-card/50 rounded-2xl border p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="bg-accent text-foreground flex h-10 w-10 items-center justify-center rounded-xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-bold">World Members</h3>
              <p className="text-muted-foreground text-xs">Active worldbuilders & players</p>
            </div>
          </div>
        </div>

        <div className="border-border bg-card/50 rounded-2xl border p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="bg-accent text-foreground flex h-10 w-10 items-center justify-center rounded-xl">
              <Map className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-bold">Atlas Mesh</h3>
              <p className="text-muted-foreground text-xs">100k cell Voronoi terrain</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
