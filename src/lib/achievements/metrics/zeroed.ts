/** Every key at 0: what a country loader returns when it runs without a country. */
export const zeroed = (keys: readonly string[]): Record<string, number> =>
  Object.fromEntries(keys.map((key) => [key, 0]));
