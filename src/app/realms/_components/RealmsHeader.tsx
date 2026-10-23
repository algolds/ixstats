"use client";

import Link from "next/link";
import { createUrl } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { PageHeader } from "~/components/shell/PageHeader";
import { directoryTotals, plural, type DirectoryRealm } from "./realm-directory";

/** Where the viewer stands, which picks the header's call to action. */
export type ViewerStanding = "loading" | "signed-out" | "no-nation" | "holds-nations";

function CallToAction({ standing }: { standing: ViewerStanding }) {
  if (standing === "signed-out")
    return (
      <Button asChild>
        <Link href={`/sign-in?redirect_url=${encodeURIComponent(createUrl("/realms"))}`}>
          Sign in to play
        </Link>
      </Button>
    );
  if (standing === "no-nation")
    return (
      <Button asChild>
        <a href="#atlas">Join a realm</a>
      </Button>
    );
  if (standing === "holds-nations")
    return (
      <Button asChild variant="outline">
        <a href="#atlas">Join another realm</a>
      </Button>
    );
  return null;
}

/** The atlas's headline figures as one line: "2 realms · 280 nations · 262 open". */
function countsLine(realms: DirectoryRealm[]): string {
  const totals = directoryTotals(realms);
  return `${plural(totals.realms, "realm")} · ${plural(totals.nations, "nation")} · ${totals.open.toLocaleString()} open`;
}

/** The page title with a one-line pitch for newcomers, the directory's counts and the viewer's next step. */
export function RealmsHeader({
  realms,
  standing,
}: {
  realms: DirectoryRealm[] | undefined;
  standing: ViewerStanding;
}) {
  const newcomer = standing === "signed-out" || standing === "no-nation";
  const counts = realms && realms.length > 0 ? countsLine(realms) : null;
  return (
    <PageHeader
      title="Realms"
      subtitle={
        newcomer || counts ? (
          <>
            {newcomer && (
              <span className="block">
                Worlds with their own nations, boards and lore. Claim a nation and play.
              </span>
            )}
            {counts && <span className="block tabular-nums">{counts}</span>}
          </>
        ) : undefined
      }
      actions={<CallToAction standing={standing} />}
      bleed
    />
  );
}
