"use client";

/**
 * /mycountry/map-editor — the player's country map editor as a full-screen page.
 *
 * The same editor opens in place on /maps ("Edit my map"); this route is the
 * direct entry used by the Halo registry and MyCountry links. It needs a signed-in
 * user with a country: signed-out visitors go to sign-in, users without a
 * country go to the builder.
 */

import { useEffect } from "react";
import dynamicImport from "next/dynamic";
import { useRouter } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useUserCountry } from "~/hooks/useUserCountry";
import { MapRealmProvider } from "~/components/maps/core/MapRealmContext";
import { EditorLoadingScreen } from "~/components/maps/editor/utils/editor-overlay-helpers";

export const dynamic = "force-dynamic";

const MapEditorOverlay = dynamicImport(() => import("~/components/maps/editor/MapEditorOverlay"), {
  ssr: false,
  loading: () => <EditorLoadingScreen />,
});

export default function MyCountryMapEditorPage() {
  usePageTitle({ title: "Map Editor" });

  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { profileLoading, userProfile } = useUserCountry();
  const countryId = userProfile?.countryId ?? undefined;

  const redirectTo =
    isLoaded && !user
      ? "/sign-in"
      : isLoaded && !profileLoading && !countryId
        ? "/mycountry/builder"
        : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  return (
    // Full-screen canvas above the global navigation bar (menus and dialogs still layer on top).
    <div
      className="bg-surface text-label fixed inset-0"
      style={{ zIndex: "calc(var(--z-depth-navigation, 5000) + 1)" }}
    >
      {!isLoaded || profileLoading || redirectTo || !countryId ? (
        <EditorLoadingScreen />
      ) : (
        // Players edit their own nation in their own realm (undefined = the viewer's realm).
        <MapRealmProvider value={undefined}>
          <MapEditorOverlay countryId={countryId} onExit={() => router.push("/mycountry")} />
        </MapRealmProvider>
      )}
    </div>
  );
}
