/**
 * Picks the additive part of `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema --script`, for
 * scripts/deployment/apply-additive-schema.ts. The deploy runs it after the backup and before the hand-written SQL,
 * because that SQL reads tables and columns only `db push` creates, while the push cannot run first (new required
 * columns without a default meet non-empty tables, and it would drop what the SQL still converts).
 *
 * Kept: CREATE TYPE, ALTER TYPE ... ADD VALUE, CREATE TABLE, ALTER TABLE ... ADD COLUMN that is nullable or has a
 * default, indexes on the tables this run creates (empty, so a unique one cannot fail), and foreign keys between two
 * of them. Everything else waits for the push: drops, renames, type and default changes, required columns without a
 * default, indexes and constraints on existing tables, and Prisma's BEGIN ... COMMIT enum rewrites.
 *
 * Also left to the push: every table, column and type a hand-written deploy SQL file creates, converts or renames
 * (`deferredObjects`). Those files often act only "when the column is new" (a backfill, a one-off clamp), so a column
 * created here first would skip that step for good. `NEVER_EARLY` names the ones a runbook says must wait.
 *
 * Pure: no I/O. Tested in src/tests/scripts/additive-schema.test.ts.
 */

/** Columns that must not exist before their data SQL runs, whatever the deploy's file list says. */
export const NEVER_EARLY: readonly string[] = [
  // 20261105120000_wikios_conflicts labels each existing revision classic or wikios only when it adds the column; a
  // column added first defaults every classic revision to 'wikios' (docs/operations/wikios-v1-cutover.md).
  "wiki_revisions.origin",
];

export interface DeferredObjects {
  tables: Set<string>;
  /** "table.column" */
  columns: Set<string>;
  types: Set<string>;
}

export interface Change {
  /** The statement (or the one ALTER TABLE clause) as Prisma wrote it, whitespace collapsed. */
  source: string;
  kept: boolean;
  /** Why it waits for the push; empty when kept. */
  reason: string;
}

export interface AdditivePlan {
  changes: Change[];
  /** The statements to run, in the diff's order (kept ADD COLUMN clauses regrouped per table). */
  statements: string[];
}

const IDENT = String.raw`(?:"public"\.|public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?`;

/**
 * The kept statements in the two batches they must run in. PostgreSQL refuses to use an enum value in the transaction
 * that added it ("unsafe use of new value"), so `ALTER TYPE ... ADD VALUE` commits on its own before the tables and
 * columns that may default to the new value.
 */
export function applyBatches(statements: readonly string[]): {
  enumValues: string[];
  rest: string[];
} {
  const isAddValue = (statement: string) =>
    new RegExp(`^ALTER TYPE ${IDENT} ADD VALUE`, "i").test(statement);
  return {
    enumValues: statements.filter(isAddValue),
    rest: statements.filter((statement) => !isAddValue(statement)),
  };
}

/** Splits SQL into statements on top-level semicolons, dropping comments; quotes and $$ bodies stay intact. */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      current += " ";
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      current += " ";
      continue;
    }
    const dollar = /^\$[A-Za-z0-9_]*\$/.exec(rest);
    if (dollar) {
      const end = sql.indexOf(dollar[0], i + dollar[0].length);
      const stop = end === -1 ? sql.length : end + dollar[0].length;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    const ch = sql[i]!;
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) j += 2;
        else if (sql[j] === ch) break;
        else j++;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === ";") {
      if (current.trim()) statements.push(collapse(current));
      current = "";
    } else {
      current += ch;
    }
    i++;
  }
  if (current.trim()) statements.push(collapse(current));
  return statements;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** Splits on commas outside parentheses and quotes (ALTER TABLE clauses). */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    } else if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Without string literals, so a default such as 'NOT NULL' never reads as a constraint. */
const withoutLiterals = (text: string) => text.replace(/'(?:[^']|'')*'/g, "''");

/** Quoted names in a definition: the types it uses (and its column names, which never match a deferred type). */
const quotedNames = (text: string) =>
  [...withoutLiterals(text).matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map((m) => m[1]!);

/** What the hand-written deploy SQL creates, converts or renames: left to that SQL and the push. */
export function deferredObjects(sqlFiles: readonly string[]): DeferredObjects {
  const deferred: DeferredObjects = { tables: new Set(), columns: new Set(), types: new Set() };
  for (const text of sqlFiles) {
    const body = text.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");
    for (const m of body.matchAll(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${IDENT}`, "gi")))
      deferred.tables.add(m[1]!);
    for (const m of body.matchAll(new RegExp(`CREATE TYPE (?:IF NOT EXISTS )?${IDENT}`, "gi")))
      deferred.types.add(m[1]!);
    for (const m of body.matchAll(new RegExp(`ALTER TYPE ${IDENT} RENAME`, "gi")))
      deferred.types.add(m[1]!);
    for (const m of body.matchAll(
      new RegExp(`ALTER TABLE (?:IF EXISTS )?(?:ONLY )?${IDENT} ([^;]*)`, "gi")
    )) {
      const table = m[1]!;
      const clauses = m[2]!;
      for (const c of clauses.matchAll(new RegExp(`ADD COLUMN (?:IF NOT EXISTS )?${IDENT}`, "gi")))
        deferred.columns.add(`${table}.${c[1]}`);
      for (const c of clauses.matchAll(
        new RegExp(`ALTER COLUMN ${IDENT} (?:SET DATA )?TYPE`, "gi")
      ))
        deferred.columns.add(`${table}.${c[1]}`);
      for (const c of clauses.matchAll(new RegExp(`RENAME COLUMN ${IDENT} TO ${IDENT}`, "gi")))
        deferred.columns.add(`${table}.${c[2]}`);
      for (const c of clauses.matchAll(new RegExp(`RENAME TO ${IDENT}`, "gi")))
        deferred.tables.add(c[1]!);
    }
  }
  return deferred;
}

/** Splits the diff into the statements to run now and the ones left to the push. */
export function planAdditive(
  diffSql: string,
  deferred: DeferredObjects,
  neverEarly: readonly string[] = NEVER_EARLY
): AdditivePlan {
  const statements = splitStatements(diffSql.replace(/^Loaded Prisma config.*$/gm, ""));
  const changes: Change[] = [];
  const out: string[] = [];
  const keep = (source: string, sql: string = source) => {
    changes.push({ source, kept: true, reason: "" });
    out.push(sql);
  };
  const skip = (source: string, reason: string) => changes.push({ source, kept: false, reason });

  // Types Prisma rewrites (an enum losing a value) and types the deploy SQL owns: nothing new may use them early.
  const blockedTypes = new Set(deferred.types);
  let inRewrite = false;
  for (const statement of statements) {
    if (/^BEGIN$/i.test(statement)) inRewrite = true;
    else if (/^COMMIT$/i.test(statement)) inRewrite = false;
    else if (inRewrite) {
      const created = new RegExp(`^CREATE TYPE ${IDENT}`, "i").exec(statement);
      if (created) blockedTypes.add(created[1]!.replace(/_new$/, ""));
    }
  }
  // Columns the diff drops: Prisma changes a type it cannot cast with DROP COLUMN then ADD COLUMN of the same name.
  const droppedColumns = new Set<string>();
  for (const statement of statements) {
    const alter = new RegExp(`^ALTER TABLE ${IDENT} (.*)$`, "i").exec(statement);
    if (!alter) continue;
    for (const c of alter[2]!.matchAll(new RegExp(`DROP COLUMN (?:IF EXISTS )?${IDENT}`, "gi")))
      droppedColumns.add(`${alter[1]}.${c[1]}`);
  }

  const newTables = new Set<string>();
  const usesBlockedType = (definition: string) =>
    quotedNames(definition).find((name) => blockedTypes.has(name));

  inRewrite = false;
  for (const statement of statements) {
    if (/^BEGIN$/i.test(statement)) {
      inRewrite = true;
      skip(statement, "an enum rewrite (a value removed): left to the push");
      continue;
    }
    if (/^COMMIT$/i.test(statement)) {
      inRewrite = false;
      continue;
    }
    if (inRewrite) {
      skip(statement, "part of an enum rewrite: left to the push");
      continue;
    }

    const createType = new RegExp(`^CREATE TYPE ${IDENT} AS ENUM`, "i").exec(statement);
    if (createType) {
      if (blockedTypes.has(createType[1]!))
        skip(statement, `type "${createType[1]}" is created by the deploy SQL`);
      else keep(statement);
      continue;
    }

    const addValue = new RegExp(`^ALTER TYPE ${IDENT} ADD VALUE`, "i").exec(statement);
    if (addValue) {
      if (blockedTypes.has(addValue[1]!))
        skip(statement, `type "${addValue[1]}" is created or converted by the deploy SQL`);
      else keep(statement);
      continue;
    }

    const createTable = new RegExp(`^CREATE TABLE ${IDENT} \\(`, "i").exec(statement);
    if (createTable) {
      const table = createTable[1]!;
      const blocked = usesBlockedType(statement);
      if (deferred.tables.has(table))
        skip(statement, `table "${table}" is created by the deploy SQL`);
      else if (blocked)
        skip(statement, `uses type "${blocked}", which waits for the deploy SQL or the push`);
      else {
        newTables.add(table);
        keep(statement);
      }
      continue;
    }

    const alterTable = new RegExp(`^ALTER TABLE ${IDENT} (.*)$`, "i").exec(statement);
    if (alterTable) {
      const table = alterTable[1]!;
      const head = statement.slice(0, statement.length - alterTable[2]!.length).trim();
      const keptClauses: string[] = [];
      for (const clause of splitTopLevel(alterTable[2]!)) {
        const source = `${head} ${clause}`;
        const reason = clauseRefusal(table, clause, {
          deferred,
          neverEarly,
          droppedColumns,
          newTables,
          usesBlockedType,
        });
        if (reason) skip(source, reason);
        else {
          changes.push({ source, kept: true, reason: "" });
          keptClauses.push(clause);
        }
      }
      if (keptClauses.length > 0) out.push(`${head} ${keptClauses.join(", ")}`);
      continue;
    }

    const createIndex = new RegExp(
      `^CREATE (?:UNIQUE )?INDEX (?:CONCURRENTLY )?(?:IF NOT EXISTS )?${IDENT} ON ${IDENT}`,
      "i"
    ).exec(statement);
    if (createIndex) {
      if (newTables.has(createIndex[2]!)) keep(statement);
      else skip(statement, `an index on the existing table "${createIndex[2]}": left to the push`);
      continue;
    }

    skip(statement, "not additive: left to the push");
  }
  return { changes, statements: out };
}

interface ClauseContext {
  deferred: DeferredObjects;
  neverEarly: readonly string[];
  droppedColumns: Set<string>;
  newTables: Set<string>;
  usesBlockedType: (definition: string) => string | undefined;
}

/** Why one ALTER TABLE clause waits for the push, or null when it can run now. */
function clauseRefusal(table: string, clause: string, ctx: ClauseContext): string | null {
  const addColumn = new RegExp(`^ADD COLUMN (?:IF NOT EXISTS )?${IDENT}(.*)$`, "i").exec(clause);
  if (addColumn) {
    const column = `${table}.${addColumn[1]}`;
    const definition = withoutLiterals(addColumn[2]!);
    const blocked = ctx.usesBlockedType(addColumn[2]!);
    if (ctx.neverEarly.includes(column)) return `${column} must wait for its data SQL`;
    if (ctx.deferred.columns.has(column) || ctx.deferred.tables.has(table))
      return `${column} is added or converted by the deploy SQL`;
    if (ctx.droppedColumns.has(column)) return `${column} changes type (dropped and re-added)`;
    if (blocked) return `uses type "${blocked}", which waits for the deploy SQL or the push`;
    const hasDefault = /\bDEFAULT\b|\b(SMALL|BIG)?SERIAL\b|\bGENERATED\b/i.test(definition);
    if (/\bNOT NULL\b/i.test(definition) && !hasDefault)
      return `${column} is required without a default`;
    return null;
  }
  const foreignKey = new RegExp(
    `^ADD CONSTRAINT ${IDENT} FOREIGN KEY \\(.*?\\) REFERENCES ${IDENT}`,
    "i"
  ).exec(clause);
  if (foreignKey) {
    if (ctx.newTables.has(table) && ctx.newTables.has(foreignKey[2]!)) return null;
    return "a foreign key touching an existing table: left to the push";
  }
  return "not additive: left to the push";
}
