/**
 * continuation.ts — opaque continuation values and the `continue` block (plan 410).
 *
 * A list module answers one page of its items and a continuation value naming where the next page
 * starts. Bots treat it as opaque and send it back; here it is the parts of an ordering key
 * (`timestamp|id`, a title) with each part URI-escaped and the parts joined by `|`.
 */

import { badContinue } from "./errors";
import type { JsonObject } from "./format";

export type CursorPart = string | number;

export function encodeCursor(parts: readonly CursorPart[]): string {
  return parts.map((part) => encodeURIComponent(String(part))).join("|");
}

/** The parts of a cursor made by `encodeCursor`; `kinds` says which are numbers. Anything else is `badcontinue`. */
export function decodeCursor<K extends readonly ("s" | "n")[]>(
  raw: string,
  kinds: K
): { [I in keyof K]: K[I] extends "n" ? number : string } {
  const pieces = raw.split("|");
  if (pieces.length !== kinds.length) throw badContinue();
  try {
    const parts = pieces.map((piece, index) => {
      const text = decodeURIComponent(piece);
      if (kinds[index] === "s") return text;
      if (!/^-?\d+$/.test(text)) throw badContinue();
      return Number(text);
    });
    return parts as { [I in keyof K]: K[I] extends "n" ? number : string };
  } catch {
    throw badContinue();
  }
}

/** A cursor if `raw` is present, else undefined. */
export function optionalCursor<K extends readonly ("s" | "n")[]>(
  raw: string | undefined,
  kinds: K
): { [I in keyof K]: K[I] extends "n" ? number : string } | undefined {
  return raw === undefined || raw === "" ? undefined : decodeCursor(raw, kinds);
}

/** One page of `items` out of up to `limit + 1` fetched: the page, and whether there is more. */
export function takePage<T>(fetched: readonly T[], limit: number): { page: T[]; more: boolean } {
  return { page: fetched.slice(0, limit), more: fetched.length > limit };
}

/**
 * The continuation of one query: every module that has more adds its own `<prefix>continue`
 * value, and `batchcomplete` says whether the data asked for the current page set is all there
 * (props and the generator's page set; a list that continues does not hold the batch back).
 */
export class Continuation {
  private readonly values: Record<string, string> = {};
  private generatorKey: string | null = null;
  private propsIncomplete = false;

  /** A list module has more: `name` is its full parameter (`apcontinue`). */
  add(name: string, value: string): void {
    this.values[name] = value;
  }

  /** The generator has more pages (`gapcontinue`). */
  addGenerator(name: string, value: string): void {
    this.values[name] = value;
    this.generatorKey = name;
  }

  /** A prop module has more for the current page set. */
  addProp(name: string, value: string): void {
    this.values[name] = value;
    this.propsIncomplete = true;
  }

  get isEmpty(): boolean {
    return Object.keys(this.values).length === 0;
  }

  get batchComplete(): boolean {
    return !this.propsIncomplete;
  }

  /** `continue` (the values and the generic marker) and `batchcomplete`, to merge into the response. */
  toResult(): JsonObject {
    const result: JsonObject = {};
    if (this.batchComplete) result.batchcomplete = true;
    if (!this.isEmpty) {
      const marker = this.generatorKey ? `${this.generatorKey}||` : this.propsIncomplete ? "||" : "-||";
      result.continue = { ...this.values, continue: marker };
    }
    return result;
  }
}
