import Link from "next/link";
import type { RouterOutputs } from "~/trpc/react";

type Overview = NonNullable<RouterOutputs["realms"]["region"]["overview"]>;

/** The realm's founding members, in the order staff set, each linked to their passport or nation when they have one. */
export function FounderNames({ founders }: { founders: Overview["founders"] }) {
  return founders.map((founder, index) => (
    <span key={`${founder.name}:${index}`}>
      {index > 0 && ", "}
      {founder.link ? (
        <Link href={founder.link} className="hover:underline">
          {founder.name}
        </Link>
      ) : (
        founder.name
      )}
    </span>
  ));
}
