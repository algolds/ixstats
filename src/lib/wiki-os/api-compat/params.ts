/**
 * params.ts — reading api.php request parameters (plan 410).
 *
 * A parameter means the same in the query string and in a POST body (the body wins). A multi-value
 * parameter joins its values with `|`; when the first character is U+001F the values are separated
 * by U+001F instead, so a value may itself hold a `|`. A flag is true when the parameter is present
 * at all, whatever its value (MediaWiki's checkbox rule). Module parameters carry the module's
 * prefix (`aplimit`); `scope` returns a view that reads them without it.
 */

import {
  badInteger,
  badTimestamp,
  badValue,
  badValues,
  missingParam,
  tooManyValues,
} from "./errors";
import { parseMWDateObject } from "~/lib/wiki-os/adapters/mediawiki/timestamp";

/** `limit=max`: the cap of an ordinary caller and of one holding `apihighlimits`. */
export const NORMAL_LIMIT = 500;
export const HIGH_LIMIT = 5000;
/** Titles (or ids) one request may name, for an ordinary caller and one holding `apihighlimits`. */
export const NORMAL_VALUE_LIMIT = 50;
export const HIGH_VALUE_LIMIT = 500;

const UNIT_SEPARATOR = "\u001f";

/** The values of a multi-value parameter; `""` has none. */
export function splitMultiValue(value: string): string[] {
  if (value === "") return [];
  if (value.startsWith(UNIT_SEPARATOR)) return value.slice(1).split(UNIT_SEPARATOR);
  return value.split("|");
}

export type WarningSink = (module: string, text: string) => void;

export interface LimitOptions {
  /** Used when the parameter is absent. */
  fallback: number;
  /** Whether the caller holds `apihighlimits`. */
  high: boolean;
}

export class ApiParams {
  private constructor(
    private readonly values: ReadonlyMap<string, string>,
    private readonly warn: WarningSink,
    private readonly prefix: string,
    private readonly moduleName: string
  ) {}

  /** Later entries override earlier ones, so pass the query string first and the body second. */
  static from(entries: Iterable<readonly [string, string]>, warn: WarningSink = () => undefined) {
    return new ApiParams(new Map(entries), warn, "", "main");
  }

  /** The same parameters read through a module's prefix: `scope("ap", "allpages").string("from")` reads `apfrom`. */
  scope(prefix: string, moduleName: string): ApiParams {
    return new ApiParams(this.values, this.warn, prefix, moduleName);
  }

  /** The full name of `name` in this view (what an error message must say). */
  fullName(name: string): string {
    return `${this.prefix}${name}`;
  }

  addWarning(text: string): void {
    this.warn(this.moduleName, text);
  }

  has(name: string): boolean {
    return this.values.has(this.fullName(name));
  }

  /** The raw value, or undefined when the parameter is absent. */
  raw(name: string): string | undefined {
    return this.values.get(this.fullName(name));
  }

  string(name: string): string | undefined;
  string(name: string, fallback: string): string;
  string(name: string, fallback?: string): string | undefined {
    return this.raw(name) ?? fallback;
  }

  required(name: string): string {
    const value = this.raw(name);
    if (value === undefined) throw missingParam(this.fullName(name));
    return value;
  }

  /** True when present, with any value (`minor=` counts, as in MediaWiki). */
  flag(name: string): boolean {
    return this.has(name);
  }

  /** An integer in `[min, max]`; a value outside the range is clamped with a warning, as MediaWiki does. */
  integer(name: string, options: { fallback: number; min?: number; max?: number }): number {
    const raw = this.raw(name);
    if (raw === undefined) return options.fallback;
    if (!/^-?\d+$/.test(raw.trim())) throw badInteger(this.fullName(name), raw);
    const value = Number(raw.trim());
    const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = options;
    if (value < min) {
      this.addWarning(`${this.fullName(name)} may not be less than ${min} (set to ${value}).`);
      return min;
    }
    if (value > max) {
      this.addWarning(`${this.fullName(name)} may not be over ${max} (set to ${value}).`);
      return max;
    }
    return value;
  }

  /** An integer that may be absent. */
  optionalInteger(name: string, min = 0): number | undefined {
    return this.has(name) ? this.integer(name, { fallback: 0, min }) : undefined;
  }

  /** A page-size parameter: `max`, or a number capped at the caller's limit. */
  limit(name: string, { fallback, high }: LimitOptions): number {
    const cap = high ? HIGH_LIMIT : NORMAL_LIMIT;
    if (this.raw(name) === "max") return cap;
    return this.integer(name, { fallback, min: 1, max: cap });
  }

  /** The values of a multi-value parameter (empty when absent), at most `max` of them. */
  list(name: string, max = Number.POSITIVE_INFINITY): string[] {
    const values = splitMultiValue(this.raw(name) ?? "");
    if (values.length > max) throw tooManyValues(this.fullName(name), max);
    return values;
  }

  /** One value out of `allowed`; anything else is `badvalue`. */
  oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T;
  oneOf<T extends string>(name: string, allowed: readonly T[]): T | undefined;
  oneOf<T extends string>(name: string, allowed: readonly T[], fallback?: T): T | undefined {
    const raw = this.raw(name);
    if (raw === undefined) return fallback;
    const match = allowed.find((value) => value === raw);
    if (match === undefined) throw badValue(this.fullName(name), raw);
    return match;
  }

  /** Several values, each out of `allowed`; absent means `fallback`. */
  listOf<T extends string>(name: string, allowed: readonly T[], fallback: readonly T[] = []): T[] {
    if (!this.has(name)) return [...fallback];
    const values = this.list(name);
    const unknown = values.filter((value) => !allowed.some((known) => known === value));
    if (unknown.length > 0) throw badValues(this.fullName(name), unknown);
    return values as T[];
  }

  /** A timestamp (ISO 8601 or MediaWiki's 14 digits); `now` is `now`. */
  timestamp(name: string, now: Date): Date | undefined {
    const raw = this.raw(name);
    if (raw === undefined) return undefined;
    if (raw === "now") return now;
    const parsed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$|^\d{14}$/.test(raw)
      ? parseMWDateObject(raw)
      : null;
    if (!parsed) throw badTimestamp(this.fullName(name), raw);
    return parsed;
  }
}

/** The request's parameters: the query string, then the form body (which overrides it). */
export function parseRequestParams(
  query: URLSearchParams,
  body: Iterable<readonly [string, string]> | null,
  warn?: WarningSink
): ApiParams {
  return ApiParams.from([...query.entries(), ...(body ?? [])], warn);
}
