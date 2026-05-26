# Chunked TypeScript Typecheck

> **Note:** The OOM issue that motivated this script has been resolved. Use `bun run typecheck` for full typechecking across all sub-projects. This chunked script remains available as an alternative for very granular per-file diagnostics.

This script runs `tsc` on small groups of files sequentially and writes per-chunk logs.

Usage

Run from the repo root:

```bash
bash scripts/typecheck-chunks.sh [chunk-size] [out-dir]
```

Examples

- Run with default chunk size (50):

```bash
bash scripts/typecheck-chunks.sh
```

- Run with 30 files per chunk and custom log folder:

```bash
bash scripts/typecheck-chunks.sh 30 logs/typecheck-chunks-30
```

Notes & Recommendations

- Default `NODE_OPTIONS='--max-old-space-size=4096'` is applied per chunk; adjust if you have more memory.
- The script uses `--skipLibCheck` to reduce memory usage; this mirrors existing project practices.
- Files are grouped by their top-level directory under `src/` (for example `app`, `components`, `lib`, `server`, `hooks`). Each group is split into chunks and run sequentially. Logs are organized per-group in the output folder: `logs/typecheck-chunks/<group>/chunk-1.log`.
- The script continues through all groups/chunks and writes an aggregated summary to `logs/typecheck-chunks/summary.log` which lists each group/chunk status and failed logs.
- For long-term reliability and IDE integration, consider converting the repo to use TypeScript Project References and `composite` builds (larger refactor). This script is a safe short-term option.

Files

- Script: [scripts/typecheck-chunks.sh](scripts/typecheck-chunks.sh)
