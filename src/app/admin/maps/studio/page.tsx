"use client";
export const dynamic = "force-dynamic";

/**
 * World Studio: the generator workbench, a full-screen route like the world editor. The admin layout and the app shell
 * both leave it chromeless (`/admin/maps/studio` is listed in each). `?fit=<realm slug>` opens it fitted to that realm.
 */

import dynamicImport from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";

const WorldStudio = dynamicImport(() => import("~/components/maps/studio/WorldStudio"), {
  ssr: false,
  loading: () => (
    <p className="text-label-secondary flex h-full items-center justify-center">
      Loading the Studio.
    </p>
  ),
});

export default function WorldStudioPage() {
  usePageTitle({ title: "Admin - World Studio" });
  const fit = useSearchParams().get("fit");

  return (
    <div data-app="maps" className="bg-background text-label absolute inset-0 z-40">
      {/* Keyed by the realm, so a link to another realm starts over from it */}
      <WorldStudio key={fit ?? ""} fit={fit} />
    </div>
  );
}
