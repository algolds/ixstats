import { Badge } from "~/components/ui/badge";
import { flagLabel, type RealmRow } from "./realms-view";

/** A realm's problems as chips; none for a realm with no problems. */
export function RealmFlags({ row }: { row: Pick<RealmRow, "flags" | "relief"> }) {
  if (row.flags.length === 0) return <span className="text-label-secondary">None</span>;
  return (
    <ul className="flex flex-wrap gap-1">
      {row.flags.map((flag) => (
        <li key={flag}>
          <Badge variant="warning">{flagLabel(flag, row)}</Badge>
        </li>
      ))}
    </ul>
  );
}
