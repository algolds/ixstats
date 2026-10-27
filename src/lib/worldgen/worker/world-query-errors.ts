/**
 * A request the world outran: a newer generate replaced the world it asked about, the worker was replaced, or there
 * was no world to ask. The answer is for a world no one is looking at, so callers drop it without a word and ask again
 * once the new world lands. Matches the messages `WorldGenSession` rejects with.
 */
export const isOutrunMessage = (message: string): boolean =>
  /world (has )?changed|was restarted|no world to draw/i.test(message);

/**
 * What the worker answers when the pixels were drawn but the browser could not encode them as a PNG (in practice its
 * canvas limit at that width). Any other failed render answers with its own message.
 */
export const ENCODE_FAILED = "The image could not be encoded";

export const isEncodeFailure = (message: string): boolean => message === ENCODE_FAILED;
