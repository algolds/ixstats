/**
 * An in-memory `lorewardEntry` table for the Lorewards sync tests. It answers the `where` shapes the sync uses
 * (equality, `in`, `startsWith`, `not: null`, `OR`, the `date_type` key), so a test reads what a query really
 * selects instead of a canned answer.
 */

export interface StoredEntry {
  id: string;
  date: string;
  type: string;
  dateStart: string | null;
  dateEnd: string | null;
  status: string;
  winnerUser: string | null;
  winnerPage: string | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
  winnerBytes: number | null;
  /** Set when an admin override wrote the places: no sync writes them again. */
  overriddenAt: Date | null;
}

type Field = string | number | Date | null;
type Condition = Field | { in?: Field[]; startsWith?: string; not?: null };
interface Where {
  [field: string]: Condition | Where[] | undefined;
}
interface DateType {
  date_type: { date: string; type: string };
}

function fieldOf(row: StoredEntry, field: string): Field {
  const record: Record<keyof StoredEntry, Field> = row;
  return field in record ? record[field as keyof StoredEntry] : null;
}

function holds(value: Field, condition: Condition): boolean {
  if (condition === null || typeof condition !== "object") return value === condition;
  if (condition.in) return condition.in.includes(value);
  if (condition.startsWith !== undefined) {
    return typeof value === "string" && value.startsWith(condition.startsWith);
  }
  return value !== null;
}

/** Whether `row` meets `where`: every field condition, and one of `OR` when given. */
export function matches(row: StoredEntry, where: Where): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (condition === undefined) return true;
    if (Array.isArray(condition)) return condition.some((branch) => matches(row, branch));
    return holds(fieldOf(row, field), condition);
  });
}

export const storedEntry = (over: Partial<StoredEntry> & { id: string }): StoredEntry => ({
  date: "2026-10-16",
  type: "daily",
  dateStart: null,
  dateEnd: null,
  status: "approved",
  winnerUser: null,
  winnerPage: null,
  runnerUpUser: null,
  runnerUpPage: null,
  winnerBytes: null,
  overriddenAt: null,
  ...over,
});

/** The table's delegate over `rows` (changed in place by create, update and upsert). */
export function entryStore(rows: StoredEntry[]) {
  const at = ({ date_type }: DateType) =>
    rows.find((row) => row.date === date_type.date && row.type === date_type.type);
  const create = (data: Partial<StoredEntry>) => {
    const row = storedEntry({ id: `new-${rows.length + 1}`, ...data });
    rows.push(row);
    return row;
  };
  return {
    findMany: jest.fn(async ({ where }: { where: Where }) =>
      rows.filter((row) => matches(row, where))
    ),
    findFirst: jest.fn(
      async ({ where }: { where: Where }) => rows.find((row) => matches(row, where)) ?? null
    ),
    findUnique: jest.fn(async ({ where }: { where: DateType }) => at(where) ?? null),
    create: jest.fn(async ({ data }: { data: Partial<StoredEntry> }) => create(data)),
    update: jest.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<StoredEntry> }) => {
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }
    ),
    upsert: jest.fn(
      async (args: {
        where: DateType;
        create: Partial<StoredEntry>;
        update: Partial<StoredEntry>;
      }) => {
        const row = at(args.where);
        return row ? Object.assign(row, args.update) : create(args.create);
      }
    ),
  };
}
