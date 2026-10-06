"use client";

import Link from "next/link";
import { createUrl } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { openToJoinCount, type DirectoryRealm } from "./realm-directory";

/** Where the viewer stands, which picks the hero's call to action. */
export type ViewerStanding = "loading" | "signed-out" | "no-nation" | "holds-nations";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-label-secondary text-caption">{label}</dt>
      <dd className="text-label text-headline tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}

function CallToAction({
  standing,
  joinHref,
}: {
  standing: ViewerStanding;
  /** The section a newcomer joins from: Open to join, else Browse. */
  joinHref: string;
}) {
  const browse = (
    <Button asChild variant="outline">
      <a href="#browse-realms">Browse realms</a>
    </Button>
  );
  if (standing === "signed-out")
    return (
      <>
        <Button asChild>
          <Link
            href={createUrl(`/sign-in?redirect_url=${encodeURIComponent(createUrl("/realms"))}`)}
          >
            Sign in to play
          </Link>
        </Button>
        {browse}
      </>
    );
  if (standing === "no-nation")
    return (
      <>
        <Button asChild>
          <a href={joinHref}>Join a realm</a>
        </Button>
        {browse}
      </>
    );
  if (standing === "holds-nations")
    return (
      <>
        <Button asChild>
          <a href="#your-realms">Go to your realms</a>
        </Button>
        <Button asChild variant="outline">
          <a href={joinHref}>Join another realm</a>
        </Button>
      </>
    );
  return browse;
}

/** What realms are, how many are open, and the one next step for this viewer. */
export function RealmsHero({
  realms,
  standing,
  joinHref,
}: {
  realms: DirectoryRealm[] | undefined;
  standing: ViewerStanding;
  joinHref: string;
}) {
  const nations = realms?.reduce((sum, realm) => sum + realm.nationCount, 0) ?? 0;
  const open = realms?.reduce((sum, realm) => sum + openToJoinCount(realm), 0) ?? 0;

  return (
    <header className="border-separator bg-surface rounded-card flex flex-col gap-4 border p-4 md:p-8">
      <div className="max-w-2xl">
        <h1 className="text-label text-large-title">Realms</h1>
        <p className="text-label-secondary text-body mt-2">
          A realm is a world for nations to live in. Each has its own nations, a board where they
          talk, officers and a factbook. Find one you like, claim a nation and start playing.
        </p>
      </div>
      {realms && realms.length > 0 && (
        <dl className="grid max-w-md grid-cols-3 gap-4">
          <Stat label="Realms" value={realms.length} />
          <Stat label="Nations" value={nations} />
          <Stat label="Open to claim" value={open} />
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <CallToAction standing={standing} joinHref={joinHref} />
      </div>
    </header>
  );
}
