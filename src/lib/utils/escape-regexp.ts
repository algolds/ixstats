/** Escapes a string for literal use inside a RegExp. */
export const escapeRegExp = (value: string) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
