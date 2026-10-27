/**
 * `Promise.all(items.map(work))` with at most `limit` pieces of work running at once: each worker takes the next item
 * as it finishes the last. A limit that is not a number of at least one (NaN, 0, negative, a fraction below one) runs
 * one at a time. Answers in the input's order; rejects with the first failure, after which no worker takes another
 * item. Pure.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await work(items[index]!, index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const cap = limit >= 1 ? limit : 1;
  const workers = Math.min(cap, items.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
