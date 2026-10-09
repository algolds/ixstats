/**
 * Arguments of the XenForo importer (scripts/migrations/import-xenforo-forum.ts), with the production guard. Pure.
 *   --snapshot DIR [--node-map FILE] [--apply] [--accept-defaults] [--production] [--report FILE]
 *   --snapshot DIR --rollback --yes [--production]
 */
import { productionDatabaseRefusal } from "../lib/database-guard";

export interface ImportArgs {
  snapshot: string;
  nodeMap: string | null;
  report: string | null;
  apply: boolean;
  acceptDefaults: boolean;
  production: boolean;
  rollback: boolean;
}

const VALUE_FLAGS = ["--snapshot", "--node-map", "--report"] as const;
const SWITCHES = ["--apply", "--accept-defaults", "--production", "--rollback", "--yes"] as const;

type ValueFlag = (typeof VALUE_FLAGS)[number];

const isValueFlag = (arg: string): arg is ValueFlag => VALUE_FLAGS.some((f) => f === arg);
const isSwitch = (arg: string) => SWITCHES.some((f) => f === arg);

function readFlags(argv: readonly string[]) {
  const values = new Map<ValueFlag, string>();
  const switches = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (isSwitch(arg)) switches.add(arg);
    else if (isValueFlag(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      values.set(arg, value);
      i += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return { values, switches };
}

function modeError(switches: ReadonlySet<string>): string | null {
  if (!switches.has("--rollback")) return null;
  if (switches.has("--apply")) return "--rollback and --apply cannot be combined";
  if (!switches.has("--yes")) {
    return "--rollback deletes every imported thread, native replies posted on them included: pass --yes";
  }
  return null;
}

/** The parsed arguments, or why the run must not start (bad arguments, or the production database). */
export function parseImportArgs(
  argv: readonly string[],
  databaseUrl: string | undefined
): { args: ImportArgs } | { error: string } {
  let flags: ReturnType<typeof readFlags>;
  try {
    flags = readFlags(argv);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const { values, switches } = flags;
  const snapshot = values.get("--snapshot");
  if (!snapshot) return { error: "--snapshot <dir> is required (the export's --out directory)" };
  const mode = modeError(switches);
  if (mode) return { error: mode };
  const production = switches.has("--production");
  const refusal = productionDatabaseRefusal(databaseUrl, production);
  if (refusal) return { error: refusal };
  return {
    args: {
      snapshot,
      nodeMap: values.get("--node-map") ?? null,
      report: values.get("--report") ?? null,
      apply: switches.has("--apply"),
      acceptDefaults: switches.has("--accept-defaults"),
      production,
      rollback: switches.has("--rollback"),
    },
  };
}
