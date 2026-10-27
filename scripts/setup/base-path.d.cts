/** `value` as a base path: a leading slash, no trailing one, "" for none. */
export declare function normalizeBasePath(value: string | undefined): string;

/** The base path IxStates is served under (see base-path.cjs). */
export declare function resolveBasePath(env?: Record<string, string | undefined>): string;
