"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { MyClaims } from "~/app/r/[realm]/_components/MyClaims";
import { AtlasGrid } from "./_components/AtlasGrid";
import { RealmFeedPanel } from "./_components/RealmFeedPanel";
import { RealmSearch } from "./_components/RealmSearch";
import { RealmsHeader, type ViewerStanding } from "./_components/RealmsHeader";
import { YourRealms } from "./_components/YourRealms";

/**
 * The realms landing page: the header, the atlas of every listed realm (most open first) and the viewer's
 * claims in the main column, and a rail with one search for realms and nations, the viewer's own realms and
 * the realm feed.
 */
export default function RealmsLandingPage() {
  usePageTitle({ title: "Realms" });
  const [query, setQuery] = useState("");
  const { isLoaded, isSignedIn } = useAuth();
  const { data: realms, isLoading } = api.realms.directory.useQuery();
  const { data: mine } = api.realms.myNations.useQuery(undefined, { enabled: !!isSignedIn });
  const myRealms = mine?.realms ?? [];
  const { data: profile } = api.users.getProfile.useQuery(undefined, {
    enabled: myRealms.length > 0,
  });

  const standing: ViewerStanding = !isLoaded
    ? "loading"
    : !isSignedIn
      ? "signed-out"
      : !mine
        ? "loading"
        : myRealms.length > 0
          ? "holds-nations"
          : "no-nation";

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-8">
      <RealmsHeader realms={realms} standing={standing} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <AtlasGrid realms={realms} isLoading={isLoading} query={query} />
          {isSignedIn && <MyClaims />}
        </div>
        <aside className="flex flex-col gap-4 max-lg:contents">
          <div className="max-lg:order-first">
            <RealmSearch query={query} onQueryChange={setQuery} />
          </div>
          {isSignedIn && (
            <YourRealms
              realms={myRealms}
              directory={realms}
              activeCountryId={profile?.countryId ?? mine?.activeCountryId ?? null}
            />
          )}
          <RealmFeedPanel realms={realms} />
        </aside>
      </div>
    </div>
  );
}
