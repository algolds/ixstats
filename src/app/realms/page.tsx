"use client";

import { api } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { MyClaims } from "~/app/r/[realm]/_components/MyClaims";
import { BrowseRealms } from "./_components/BrowseRealms";
import { OpenToJoin, openRealms } from "./_components/OpenToJoin";
import { RealmFeedPanel } from "./_components/RealmFeedPanel";
import { RealmSearch } from "./_components/RealmSearch";
import { RealmsHero, type ViewerStanding } from "./_components/RealmsHero";
import { YourRealms } from "./_components/YourRealms";

/**
 * The realms landing page: what realms are, the viewer's own realms and claims, one search for realms and
 * nations, the realms open to join, every listed realm, and the realm feed.
 */
export default function RealmsLandingPage() {
  usePageTitle({ title: "Realms" });
  const { isLoaded, isSignedIn } = useAuth();
  const { data: realms, isLoading } = api.realms.directory.useQuery();
  const { data: mine } = api.realms.myNations.useQuery(undefined, { enabled: !!isSignedIn });
  const myRealms = mine?.realms ?? [];
  const { data: profile } = api.users.getProfile.useQuery(undefined, {
    enabled: myRealms.length > 0,
  });
  const open = openRealms(realms);

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <RealmsHero
        realms={realms}
        standing={standing}
        joinHref={open.length > 0 ? "#open-to-join" : "#browse-realms"}
      />

      {isSignedIn && (
        <>
          <YourRealms
            realms={myRealms}
            directory={realms}
            activeCountryId={profile?.countryId ?? mine?.activeCountryId ?? null}
          />
          <MyClaims />
        </>
      )}

      <RealmSearch realms={realms} />

      <OpenToJoin realms={open} />

      <BrowseRealms realms={realms} isLoading={isLoading} />

      <RealmFeedPanel realms={realms} />
    </div>
  );
}
