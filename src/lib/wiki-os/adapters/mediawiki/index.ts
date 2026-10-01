/**
 * index.ts — Unified MediaWiki Adapter Barrel Export
 *
 * Exposes Parsoid conversion, Action API writing (the mirror account's calls), 14-digit timestamp utilities,
 * and direct MariaDB / HTTP federator bridges.
 */

export * from "./parsoid";
export * from "./write-service";
export * from "./timestamp";
export * from "./bridge/index";
