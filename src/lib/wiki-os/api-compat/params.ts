/**
 * params.ts — reading api.php request parameters (plan 410).
 *
 * A parameter means the same in the query string and in a POST body (the body wins). A multi-value
 * parameter joins its values with `|`; when the first character is U+001F the values are separated
 * by U+001F instead, so a value may itself hold a `|`. A flag is true when the parameter is present
 * at all, whatever its value (MediaWiki's checkbox rule). Module parameters carry the module's
 * prefix (`aplimit`); `scope` returns a view that reads them without it.
 *
 * Every read can also be recorded (`ApiParams.introspect`): `action=paraminfo` runs a module over
 * empty parameters and keeps what it asked for, so the parameter list a module advertises is the
 * list it reads, with no second table to keep in step.
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
/** Modules (or props, flags) one parameter may name: a list of enumerated values never needs more. */
export const MAX_MODULE_VALUES = 50;

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

/** One parameter a module reads, as `action=paraminfo` describes it. */
export interface ParamDefinition {
  /** Without the module's prefix. */
  name: string;
  /** A kind, or the values of an enumeration. */
  type: "string" | "boolean" | "integer" | "limit" | "timestamp" | "namespace" | readonly string[];
  multi?: boolean;
  required?: boolean;
  default?: string | number;
  min?: number;
  max?: number;
  /** For a multi-value parameter: how many values it takes. */
  limit?: number;
  /** Only probed with `has`/`raw`: the kind is a guess. */
  loose?: boolean;
}

/** What a recorded run read: the parameters by name, and the prefixes it scoped them under. */
export class ParamRecord {
  readonly definitions = new Map<string, ParamDefinition>();
  readonly prefixes = new Set<string>();
}

/** What a required parameter reads as while recording: any non-empty text, so the module goes on to read the rest. */
const INTROSPECTION_PLACEHOLDER = "x";

export class ApiParams {
  private constructor(
    private readonly values: ReadonlyMap<string, string>,
    private readonly warn: WarningSink,
    private readonly prefix: string,
    private readonly moduleName: string,
    private readonly record: ParamRecord | null
  ) {}

  /** Later entries override earlier ones, so pass the query string first and the body second. */
  static from(entries: Iterable<readonly [string, string]>, warn: WarningSink = () => undefined) {
    return new ApiParams(new Map(entries), warn, "", "main", null);
  }

  /** No parameters at all, and every read is written to `record` (a required parameter does not throw). */
  static introspect(record: ParamRecord): ApiParams {
    return new ApiParams(new Map(), () => undefined, "", "main", record);
  }

  /** The same parameters read through a module's prefix: `scope("ap", "allpages").string("from")` reads `apfrom`. */
  scope(prefix: string, moduleName: string): ApiParams {
    if (prefix) this.record?.prefixes.add(prefix);
    return new ApiParams(this.values, this.warn, prefix, moduleName, this.record);
  }

  /** Note a read in the record; a precise definition replaces a loose one, never the other way round. */
  private note(definition: ParamDefinition): void {
    const known = this.record?.definitions.get(definition.name);
    if (this.record && (!known || known.loose)) this.record.definitions.set(definition.name, definition);
  }

  /** Say what a module reads when it reads it through `has`/`list` (a namespace is a number or `*`). */
  declare(definition: ParamDefinition): void {
    this.note(definition);
  }

  /** The full name of `name` in this view (what an error message must say). */
  fullName(name: string): string {
    return `${this.prefix}${name}`;
  }

  addWarning(text: string): void {
    this.warn(this.moduleName, text);
  }

  /** Whether the parameter is present (its kind is not known from this: see the typed readers). */
  has(name: string): boolean {
    this.note({ name, type: "string", loose: true });
    return this.values.has(this.fullName(name));
  }

  /** The raw value, or undefined when the parameter is absent. */
  raw(name: string): string | undefined {
    this.note({ name, type: "string", loose: true });
    return this.values.get(this.fullName(name));
  }

  string(name: string): string | undefined;
  string(name: string, fallback: string): string;
  string(name: string, fallback?: string): string | undefined {
    this.note({ name, type: "string", ...(fallback === undefined ? {} : { default: fallback }) });
    return this.values.get(this.fullName(name)) ?? fallback;
  }

  required(name: string): string {
    this.note({ name, type: "string", required: true });
    const value = this.values.get(this.fullName(name));
    if (value !== undefined) return value;
    if (this.record) return INTROSPECTION_PLACEHOLDER;
    throw missingParam(this.fullName(name));
  }

  /** True when present, with any value (`minor=` counts, as in MediaWiki). */
  flag(name: string): boolean {
    this.note({ name, type: "boolean" });
    return this.values.has(this.fullName(name));
  }

  /** An integer in `[min, max]`; a value outside the range is clamped with a warning, as MediaWiki does. */
  integer(name: string, options: { fallback: number; min?: number; max?: number }): number {
    this.note({ name, type: "integer", default: options.fallback, min: options.min, max: options.max });
    const raw = this.values.get(this.fullName(name));
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
    this.note({ name, type: "integer", min });
    return this.values.has(this.fullName(name)) ? this.integer(name, { fallback: 0, min }) : undefined;
  }

  /** The integers of a multi-value parameter (at most `max` of them); a value that is not an integer is `badinteger`. */
  integerList(name: string, max: number): number[] {
    this.note({ name, type: "integer", multi: true, limit: max });
    return this.list(name, max).map((value) => {
      if (!/^-?\d+$/.test(value.trim())) throw badInteger(this.fullName(name), value);
      return Number(value.trim());
    });
  }

  /** A page-size parameter: `max`, or a number capped at the caller's limit. */
  limit(name: string, { fallback, high }: LimitOptions): number {
    this.note({ name, type: "limit", default: fallback, min: 1, max: NORMAL_LIMIT });
    const cap = high ? HIGH_LIMIT : NORMAL_LIMIT;
    if (this.values.get(this.fullName(name)) === "max") return cap;
    return this.integer(name, { fallback, min: 1, max: cap });
  }

  /** The values of a multi-value parameter (empty when absent), at most `max` of them (500 unless asked otherwise). */
  list(name: string, max = HIGH_VALUE_LIMIT): string[] {
    this.note({ name, type: "string", multi: true, limit: max });
    const values = splitMultiValue(this.values.get(this.fullName(name)) ?? "");
    if (values.length > max) throw tooManyValues(this.fullName(name), max);
    return values;
  }

  /** One value out of `allowed`; anything else is `badvalue`. */
  oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T;
  oneOf<T extends string>(name: string, allowed: readonly T[]): T | undefined;
  oneOf<T extends string>(name: string, allowed: readonly T[], fallback?: T): T | undefined {
    this.note({ name, type: allowed, ...(fallback === undefined ? {} : { default: fallback }) });
    const raw = this.values.get(this.fullName(name));
    if (raw === undefined) return fallback;
    const match = allowed.find((value) => value === raw);
    if (match === undefined) throw badValue(this.fullName(name), raw);
    return match;
  }

  /**
   * Several values, each out of `allowed`, each once (`prop=info|info` is `prop=info`) and at most
   * `MAX_MODULE_VALUES` as written; absent means `fallback`.
   */
  listOf<T extends string>(name: string, allowed: readonly T[], fallback: readonly T[] = []): T[] {
    this.note({ name, type: allowed, multi: true, ...(fallback.length > 0 ? { default: fallback.join("|") } : {}) });
    if (!this.values.has(this.fullName(name))) return [...fallback];
    const values = [...new Set(this.list(name, MAX_MODULE_VALUES))];
    const unknown = values.filter((value) => !allowed.some((known) => known === value));
    if (unknown.length > 0) throw badValues(this.fullName(name), unknown);
    return values as T[];
  }

  /** A timestamp (ISO 8601 or MediaWiki's 14 digits); `now` is `now`. */
  timestamp(name: string, now: Date): Date | undefined {
    this.note({ name, type: "timestamp" });
    const raw = this.values.get(this.fullName(name));
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
