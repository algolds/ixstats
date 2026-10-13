/**
 * A request the world outran: a newer generate replaced the world it asked about, the worker was replaced, or there
 * was no world to ask. The answer is for a world no one is looking at, so callers drop it without a word and ask again
 * once the new world lands. Matches the messages `WorldGenSession` rejects with.
 */
export const isOutrunMessage = (message: string): boolean =>
  /world changed|was restarted|no world to draw/i.test(message);
