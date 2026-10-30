export interface RatchetDiff {
  grew: string[];
  fell: string[];
}

/** Compares per-file counts with the baseline; a file missing from either side counts as 0. */
export function compareToBaseline(
  now: Record<string, number>,
  baseline: Record<string, number>
): RatchetDiff {
  const diff: RatchetDiff = { grew: [], fell: [] };
  const files = [...new Set([...Object.keys(now), ...Object.keys(baseline)])].sort((a, b) =>
    a.localeCompare(b)
  );
  for (const file of files) {
    const was = baseline[file] ?? 0;
    const is = now[file] ?? 0;
    if (is > was) diff.grew.push(`${file}: ${was} -> ${is}`);
    else if (is < was) diff.fell.push(`${file}: ${was} -> ${is}`);
  }
  return diff;
}
