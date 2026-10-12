"use client";

import Link from "next/link";
import { TriangleFlag } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { formatCurrency, formatPopulation } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";
import { Pane, PaneBody, type PaneQuery } from "./Pane";

type FrontPage = RouterOutputs["frontPage"]["get"];

// ponytail: phones get the same table with the secondary columns hidden, not a second list markup.
const WIDE = "hidden lg:table-cell";
const HEAD = "text-footnote text-label-secondary px-2 pb-2 font-medium";

/** The featured realm's ten largest economies. */
export function RealmNations({
  realm,
  nations,
  query,
}: {
  realm: FrontPage["featured"] | undefined;
  nations: FrontPage["nations"];
  query: PaneQuery;
}) {
  const name = realm?.name ?? "the featured realm";
  return (
    <Pane
      content="data"
      icon={<TriangleFlag />}
      title={`Nations in ${name}`}
      link={
        realm
          ? {
              href: `/countries?realm=${encodeURIComponent(realm.slug)}`,
              label: `See all ${realm.nationCount.toLocaleString()} nations`,
            }
          : undefined
      }
    >
      <PaneBody
        query={query}
        what="nations"
        empty={nations.length === 0 ? `No nations in ${name} yet.` : null}
        rows={10}
      >
        <table className="text-callout w-full">
          <thead>
            <tr className="text-left">
              <th scope="col" className={HEAD}>
                Nation
              </th>
              <th scope="col" className={`${HEAD} ${WIDE} text-right`}>
                Population
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                GDP
              </th>
              <th scope="col" className={`${HEAD} ${WIDE} text-right`}>
                GDP per capita
              </th>
              <th scope="col" className={`${HEAD} ${WIDE}`}>
                Tier
              </th>
              <th scope="col" className={`${HEAD} ${WIDE}`}>
                Government
              </th>
            </tr>
          </thead>
          <tbody>
            {nations.map((nation) => (
              <tr key={nation.id} className="border-separator h-9 border-t">
                <td className="px-2">
                  <Link
                    href={`/countries/${encodeURIComponent(nation.slug ?? nation.id)}`}
                    className="text-label inline-flex items-center gap-2 font-medium hover:underline pointer-coarse:min-h-11"
                  >
                    {nation.flagUrl && (
                      <img
                        src={nation.flagUrl}
                        alt=""
                        width={18}
                        height={12}
                        className="rounded-control-sm h-3 w-[18px] shrink-0 object-cover"
                      />
                    )}
                    {nation.name}
                  </Link>
                </td>
                <td className={`${WIDE} px-2 text-right`}>
                  {formatPopulation(nation.currentPopulation, "–")}
                </td>
                <td className="px-2 text-right">{formatCurrency(nation.currentTotalGdp)}</td>
                <td className={`${WIDE} px-2 text-right`}>
                  {formatCurrency(nation.currentGdpPerCapita)}
                </td>
                <td className={`${WIDE} px-2`}>
                  <Badge>{nation.economicTier}</Badge>
                </td>
                <td className={`${WIDE} text-label-secondary px-2`}>
                  {nation.governmentType ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PaneBody>
    </Pane>
  );
}
