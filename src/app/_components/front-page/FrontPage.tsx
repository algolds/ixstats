"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { EntityHeader } from "~/components/ui/entity-header";
import { withBasePath } from "~/lib/base-path";
import { api, type RouterOutputs } from "~/trpc/react";
import { FeaturedRealmMap } from "./FeaturedRealmMap";
import { ForumPane } from "./ForumPane";
import { JoinPane } from "./JoinPane";
import { OpenRealmsPane } from "./OpenRealmsPane";
import { RealmHappenings } from "./RealmHappenings";
import { RealmNations } from "./RealmNations";
import { WikiPane } from "./WikiPane";

type Facts = RouterOutputs["frontPage"]["get"]["facts"];

const count = (n: number, noun: string) => `${n.toLocaleString()} ${noun}`;

function factsLine({ realms, nations, players }: Facts): string {
  return [count(realms, "realms"), count(nations, "nations"), count(players, "players")].join(
    " · "
  );
}

/**
 * The signed-out front page: IxStates as the entity, today's featured realm (map, happenings, nations), the Wiki,
 * ThinkPages and open realms, then one way to join. Each pane loads and fails on its own.
 */
export function FrontPage() {
  const query = api.frontPage.get.useQuery();
  const data = query.data;
  const featured = data?.featured ?? undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-10 md:px-6 lg:gap-5">
      <EntityHeader
        // IxStates has no logo of its own yet, so the Ixnay seal stands in. Swap in the IxStates logo here once it exists.
        art={
          <img
            src={withBasePath("/images/ix-logo.svg?v=2")}
            alt=""
            className="size-14 object-contain md:size-16"
          />
        }
        name="IxStates"
        // The header is on the canvas, not in a PageHeader band, so it clears the floating Halo itself.
        className="pt-(--shell-top-offset)"
        description="A worldbuilding platform. Build nations in shared realms, map them, write their history and run their economies."
        facts={data ? <span className="tabular-nums">{factsLine(data.facts)}</span> : undefined}
        action={
          <Button asChild>
            <Link href="/realms">Browse realms</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <FeaturedRealmMap realm={featured} query={query} className="lg:col-span-8" />
        <RealmHappenings realm={featured} parent={query} className="lg:col-span-4" />
        <div className="grid gap-4 lg:col-span-12 lg:grid-cols-3 lg:gap-5">
          <WikiPane />
          <ForumPane />
          <OpenRealmsPane realms={data?.openRealms ?? []} query={query} />
        </div>
        <div className="lg:col-span-12">
          <RealmNations realm={featured} nations={data?.nations ?? []} query={query} />
        </div>
        <div className="lg:col-span-12">
          <JoinPane />
        </div>
      </div>
    </div>
  );
}
