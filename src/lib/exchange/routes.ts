/**
 * The Exchange's addresses (docs/specs/2026-11-06-exchange-overhaul-design.md §5.2). Client-safe: the router, the
 * sidebar, notifications and the news feed all link with these. Object pages go by id (Company has no slug).
 */
import { stripBasePath } from "~/lib/base-path";

export const EXCHANGE_SECTIONS = [
  "front",
  "markets",
  "tenders",
  "portfolio",
  "leaderboards",
  "treasury",
  "companies",
] as const;
export type ExchangeSection = (typeof EXCHANGE_SECTIONS)[number];

export const EXCHANGE_PATHS = {
  front: "/exchange",
  markets: "/exchange/markets",
  tenders: "/exchange/tenders",
  portfolio: "/exchange/portfolio",
  leaderboards: "/exchange/leaderboards",
  treasury: "/exchange/treasury",
  companies: "/exchange/companies",
} as const satisfies Record<ExchangeSection, string>;

export type ExchangeObjectKind = "company" | "bond" | "nation" | "story";

export type ExchangeRoute =
  | { kind: "section"; section: ExchangeSection }
  | { kind: ExchangeObjectKind; id: string }
  | { kind: "unknown" };

const OBJECT_SEGMENTS: Record<string, ExchangeObjectKind> = {
  c: "company",
  b: "bond",
  n: "nation",
  s: "story",
};

/** The page a pathname shows (base path and trailing slash ignored). */
export function exchangeRouteOf(pathname: string): ExchangeRoute {
  const path = stripBasePath(pathname).replace(/\/+$/, "") || "/";
  const section = EXCHANGE_SECTIONS.find((s) => EXCHANGE_PATHS[s] === path);
  if (section) return { kind: "section", section };
  const match = /^\/exchange\/([cbns])\/([^/]+)$/.exec(path);
  const kind = match ? OBJECT_SEGMENTS[match[1]!] : undefined;
  return kind && match ? { kind, id: decodeURIComponent(match[2]!) } : { kind: "unknown" };
}

const objectHref = (segment: string) => (id: string) => `/exchange/${segment}/${encodeURIComponent(id)}`;
export const companyHref = objectHref("c");
export const bondHref = objectHref("b");
export const nationHref = objectHref("n");
export const storyHref = objectHref("s");

/** Markets' instrument lists (`?kind=`); Companies when absent or unknown. */
export const MARKET_KINDS = ["companies", "bonds", "funds"] as const;
export type MarketKind = (typeof MARKET_KINDS)[number];

export function marketKindOf(value: string | null | undefined): MarketKind {
  return MARKET_KINDS.find((k) => k === value) ?? "companies";
}
