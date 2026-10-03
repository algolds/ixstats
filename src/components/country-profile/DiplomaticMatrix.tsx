import { FacetList } from "~/components/ui/facet-list";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils/cn";
import type { ProfileWorld } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { diplomaticMatrix } from "./derive";
import { RelationRows } from "./WorldStanding";

/**
 * DiplomaticMatrix — partners (allied, friendly) beside tensions (tense, hostile, at war), strongest first, over the counts of
 * relations, treaties and embassies. Neutral relations are counted but not listed. Renders
 * nothing when the nation has no relations and no embassies.
 */
export function DiplomaticMatrix({
  world,
  limit = 5,
  className,
}: {
  world: Pick<ProfileWorld, "relations" | "embassies">;
  limit?: number;
  className?: string;
}) {
  const m = diplomaticMatrix(world);
  const embassies = m.embassiesHosted + m.embassiesAbroad;
  if (m.relationCount === 0 && embassies === 0) return null;

  const counts = [
    { key: "relations", label: "Relations", value: m.relationCount },
    { key: "treaties", label: "Treaties", value: m.treatyCount },
    {
      key: "embassies",
      label: "Embassies",
      value: embassies,
      hint: embassies > 0 ? `${m.embassiesHosted} hosted · ${m.embassiesAbroad} abroad` : undefined,
    },
  ];

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <dl className="grid grid-cols-3 gap-x-6 gap-y-4">
        {counts.map((c) => (
          <div key={c.key}>
            <dt className="sr-only">{c.label}</dt>
            <dd>
              <Stat
                size="sm"
                label={c.label}
                value={c.value.toLocaleString("en-US")}
                hint={c.hint}
              />
            </dd>
          </div>
        ))}
      </dl>
      {(m.partners.length > 0 || m.tensions.length > 0) && (
        <div
          className={cn(
            "grid grid-cols-1 gap-x-6 gap-y-4",
            m.partners.length > 0 && m.tensions.length > 0 && "lg:grid-cols-2"
          )}
        >
          {m.partners.length > 0 && (
            <FacetList variant="plain">
              <RelationRows relations={m.partners} limit={limit} header="Partners" />
            </FacetList>
          )}
          {m.tensions.length > 0 && (
            <FacetList variant="plain">
              <RelationRows relations={m.tensions} limit={limit} header="Tensions" />
            </FacetList>
          )}
        </div>
      )}
    </div>
  );
}
