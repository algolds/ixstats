/**
 * The page numbers a pagination row shows: the first and last page and `radius` pages either side of
 * `current`, with `"gap"` wherever numbers are not adjacent. `current` is clamped into 1..last.
 */
export function pageWindow(current: number, last: number, radius = 1): Array<number | "gap"> {
  const end = Math.max(1, last);
  const here = Math.min(Math.max(1, current), end);
  const shown = new Set([1, end]);
  for (let n = here - radius; n <= here + radius; n++) {
    if (n >= 1 && n <= end) shown.add(n);
  }
  const result: Array<number | "gap"> = [];
  let previous = 0;
  for (const n of [...shown].sort((a, b) => a - b)) {
    if (previous !== 0 && n - previous > 1) result.push("gap");
    result.push(n);
    previous = n;
  }
  return result;
}
