import Link from "next/link";
import type { RouterOutputs } from "~/trpc/react";
import { CountryLink } from "~/components/shared/country-actions/CountryLink";

type Overview = NonNullable<RouterOutputs["realms"]["region"]["overview"]>;

const COUNTRY_PATH = "/countries/";

/** A founder or officer: their passport when they have a handle, else their nation's actions sheet. */
export function PersonName({
  person,
}: {
  person: {
    name: string;
    handle: string | null;
    nation: { id: string; slug: string | null } | null;
  };
}) {
  if (person.handle) {
    return (
      <Link href={`/@${encodeURIComponent(person.handle)}`} className="hover:underline">
        {person.name}
      </Link>
    );
  }
  if (!person.nation) return <>{person.name}</>;
  return (
    <CountryLink
      country={{ id: person.nation.id, slug: person.nation.slug }}
      className="hover:underline"
    >
      {person.name}
    </CountryLink>
  );
}

/**
 * The realm's founding members, in the order staff set, each linked to their passport or nation when they have one
 * (`link`, from `personHref`): a nation opens its actions sheet.
 */
export function FounderNames({ founders }: { founders: Overview["founders"] }) {
  return founders.map((founder, index) => (
    <span key={`${founder.name}:${index}`}>
      {index > 0 && ", "}
      {founder.link?.startsWith(COUNTRY_PATH) ? (
        <CountryLink
          country={{ slug: decodeURIComponent(founder.link.slice(COUNTRY_PATH.length)) }}
          href={founder.link}
          className="hover:underline"
        >
          {founder.name}
        </CountryLink>
      ) : founder.link ? (
        <Link href={founder.link} className="hover:underline">
          {founder.name}
        </Link>
      ) : (
        founder.name
      )}
    </span>
  ));
}
