#!/usr/bin/env bash
set -euo pipefail

# Chunked TypeScript typecheck helper for large repos
# Usage: scripts/typecheck-chunks.sh [chunk-size] [out-dir]
# Example: scripts/typecheck-chunks.sh 50 logs/typecheck-chunks

CHUNK_SIZE=${1:-50}
OUT_DIR=${2:-logs/typecheck-chunks}
# optional 3rd arg: "plan" to do a dry run (print grouping/chunk plan without running tsc)
MODE=${3:-run}

# parse extra flags after the first three positional args: --group <name>, --heap <MB>
GROUP_FILTER=""
HEAP_MB="4096"
shift 3 || true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --group)
      GROUP_FILTER="$2"; shift 2;;
    --group=*)
      GROUP_FILTER="${1#*=}"; shift;;
    --heap)
      HEAP_MB="$2"; shift 2;;
    --heap=*)
      HEAP_MB="${1#*=}"; shift;;
    plan|dry)
      MODE="$1"; shift;;
    *)
      echo "Unknown option: $1"; shift;;
  esac
done

DRY_RUN=0
if [ "$MODE" = "plan" ] || [ "$MODE" = "dry" ]; then
  DRY_RUN=1
fi

mkdir -p "$OUT_DIR"

echo "Collecting .ts/.tsx files (excluding .d.ts)..."
mapfile -t files < <(find src -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.d.ts' | sort)
total=${#files[@]}
if [ "$total" -eq 0 ]; then
  echo "No files found under src/. Exiting."
  exit 0
fi

echo "Found $total files. Grouping by top-level directories under src/."

# Build groups: top-level folder under src (e.g., app, components, lib, server)
declare -A groups
for f in "${files[@]}"; do
  rel=${f#src/}
  grp=${rel%%/*}
  if [ "$grp" = "$rel" ]; then
    grp="root"
  fi
  groups["$grp"]+="$f\n"
done

summary="$OUT_DIR/summary.log"
echo "Typecheck run: $(date)" > "$summary"
echo "Total files: $total" >> "$summary"
echo "Chunk size: $CHUNK_SIZE" >> "$summary"
echo >> "$summary"

overall_failed=0

for grp in "${!groups[@]}"; do
  # read files for this group into an array
  IFS=$'\n' read -r -d '' -a grp_files < <(printf "%b" "${groups[$grp]}" && printf '\0')
  gcount=${#grp_files[@]}
  if [ "$gcount" -eq 0 ]; then
    continue
  fi

  grp_dir="$OUT_DIR/$grp"
  mkdir -p "$grp_dir"
  gchunks=$(( (gcount + CHUNK_SIZE - 1) / CHUNK_SIZE ))
  echo "Group '$grp': $gcount files -> $gchunks chunks"
  echo "Group '$grp': $gcount files -> $gchunks chunks" >> "$summary"

  for ((i=0;i<gchunks;i++)); do
    start=$((i * CHUNK_SIZE))
    chunk_files=("${grp_files[@]:start:CHUNK_SIZE}")
    echo "[$grp] Running chunk $((i+1))/$gchunks (files: ${#chunk_files[@]})..."
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "DRY: would run tsc for group=$grp chunk=$((i+1)) files=${#chunk_files[@]} -> $grp_dir/chunk-$((i+1)).log" | tee -a "$summary"
      continue
    fi

    # Export memory cap for tsc; can be overridden via --heap (MB)
    export NODE_OPTIONS="--max-old-space-size=${HEAP_MB}"

    log="$grp_dir/chunk-$((i+1)).log"
    # Create a temporary minimal tsconfig with essential compilerOptions and absolute file paths
    tmp_tsconfig="$grp_dir/tsconfig-chunk-$((i+1)).json"
    tmp_co="$grp_dir/tsconfig-co-$((i+1)).json"
    node - <<'NODE' > "$tmp_co"
const fs = require('fs');
const path = require('path');
const repo = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tsconfig.json'), 'utf8'));
const co = repo.compilerOptions || {};
const minimalCO = {
  esModuleInterop: co.esModuleInterop === undefined ? true : co.esModuleInterop,
  skipLibCheck: true,
  target: co.target || 'ES2022',
  module: co.module || 'ESNext',
  moduleResolution: co.moduleResolution || 'Bundler',
  jsx: co.jsx || 'react-jsx',
  baseUrl: co.baseUrl || '.',
  paths: co.paths || {},
  lib: co.lib || ['dom','dom.iterable','ES2022'],
  types: co.types || [],
  allowJs: co.allowJs || false,
  resolveJsonModule: co.resolveJsonModule || true,
  isolatedModules: co.isolatedModules || true,
  verbatimModuleSyntax: co.verbatimModuleSyntax || true,
  importHelpers: co.importHelpers || true
};
console.log(JSON.stringify(minimalCO, null, 2));
NODE

    # Build tsconfig with compilerOptions and absolute file paths
    printf '{\n  "compilerOptions": ' > "$tmp_tsconfig"
    cat "$tmp_co" >> "$tmp_tsconfig"
    printf ',\n  "files": [\n' >> "$tmp_tsconfig"
    for idx in "${!chunk_files[@]}"; do
      file="${chunk_files[$idx]}"
      file_abs="$(pwd)/${file}"
      if [ "$idx" -eq $((${#chunk_files[@]} - 1)) ]; then
        printf '    "%s"\n' "$file_abs" >> "$tmp_tsconfig"
      else
        printf '    "%s",\n' "$file_abs" >> "$tmp_tsconfig"
      fi
    done
    printf '  ]\n}\n' >> "$tmp_tsconfig"

    bunx tsc --noEmit --skipLibCheck --pretty false --project "$tmp_tsconfig" 2>&1 | tee "$log"
