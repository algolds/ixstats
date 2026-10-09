/**
 * Arguments of the XenForo export (scripts/migrations/export-xenforo-forum.ts). Pure.
 *   --out DIR [--rps 0.9] [--nodes 12,13] [--reset-filter] [--no-attachments] [--max-attachment-mb 25]
 *   [--retry-mismatch] [--bypass-permissions | --no-bypass-permissions] [--production]
 * `--production` only selects the environment (`.env.production.local` first, scripts/lib/load-runner-env.ts): the
 * export reads XenForo and writes the snapshot directory, never a database, so there is no database guard.
 */
export const DEFAULT_RPS = 0.9;
const DEFAULT_MAX_ATTACHMENT_MB = 25;

export interface ExportArgs {
  out: string;
  rps: number;
  nodes: number[] | null;
  resetFilter: boolean;
  attachments: boolean;
  maxAttachmentMb: number;
  bypass: boolean | "auto";
  /** Fetch attachments recorded `size_mismatch` again (I2); a plain rerun leaves them. */
  retryMismatch: boolean;
  production: boolean;
}

function valueOf(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function positive(raw: string | undefined, flag: string, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${flag} must be a positive number`);
  return value;
}

function bypassArg(argv: readonly string[]): boolean | "auto" {
  if (argv.includes("--no-bypass-permissions")) return false;
  return argv.includes("--bypass-permissions") ? true : "auto";
}

/** The parsed arguments; throws with the reason on a missing --out or a bad number. */
export function parseExportArgs(argv: readonly string[]): ExportArgs {
  const out = valueOf(argv, "--out");
  if (!out || out.startsWith("--")) {
    throw new Error("--out <dir> is required (e.g. --out .forum-import/2026-10-09)");
  }
  const nodesRaw = valueOf(argv, "--nodes");
  const nodes = nodesRaw
    ? nodesRaw.split(",").map((id) => positive(id.trim(), "--nodes", 0))
    : null;
  return {
    out,
    rps: positive(valueOf(argv, "--rps"), "--rps", DEFAULT_RPS),
    nodes,
    resetFilter: argv.includes("--reset-filter"),
    attachments: !argv.includes("--no-attachments"),
    maxAttachmentMb: positive(
      valueOf(argv, "--max-attachment-mb"),
      "--max-attachment-mb",
      DEFAULT_MAX_ATTACHMENT_MB
    ),
    bypass: bypassArg(argv),
    retryMismatch: argv.includes("--retry-mismatch"),
    production: argv.includes("--production"),
  };
}
