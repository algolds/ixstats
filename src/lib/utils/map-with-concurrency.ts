/**
 * `Promise.all(items.map(work))` with at most `limit` pieces of work running at once (at least one): each worker takes
 * the next item as it finishes the last. Answers in the input's order; rejects with the first failure. Pure.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]!, index);
    }
  };
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
