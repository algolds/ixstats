"use client";

import { CommandProfileView } from "../_components/CommandProfileView";
import { useProfileShell } from "../_components/ProfileShellContext";

/**
 * CountryProfilePage: `/countries/[slug]` (route group `(profile)`), the Factbook tab's overview:
 * the hero and key facts, then the domain stream, on the profile layer. The other Factbook
 * sections (`/factbook/<section>`), the Dossier and Activity are the deep-dives.
 * `/countries/[slug]/modeling` lives outside this route group and is unaffected.
 */
export default function CountryProfilePage() {
  const shell = useProfileShell();

  return (
    <CommandProfileView
      slug={shell.slug}
      country={shell.country}
      flagUrl={shell.flagUrl}
      isOwner={shell.isOwner}
      currentIxTime={shell.currentIxTime}
      cover={shell.cover}
    />
  );
}
