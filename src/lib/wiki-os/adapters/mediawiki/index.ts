/**
 * index.ts — Unified MediaWiki Adapter Barrel Export
 *
 * Exposes Parsoid conversion, Action API writing (the mirror account's calls), 14-digit timestamp utilities,
 * and the bridges (PostgreSQL for IxWiki, HTTP for the sister wikis).
 */

export * from "./parsoid";
export * from "./write-service";
export * from "./timestamp";
export * from "./bridge/index";
