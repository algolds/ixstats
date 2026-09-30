/**
 * index.ts — WikiOS Core Barrel Export
 *
 * Clean, structured root entry point exporting WikiOS domain services,
 * transformers, templates, editor state, adapters, and guardian security.
 */

// Global Configuration, Auth & Storage
export * from "./config";
export * from "./types";
export * from "./auth";
export * from "./use-wiki-auth";
export * from "./storage";

// Core Domain & PostgreSQL Repositories
export * from "./core/index";

// Security & Cloudflare Defense
export * from "./guardian/index";

// Content Transformers & Tokenizers
export * from "./transformers/index";

// Template Engine & Registry
export * from "./templates/index";

// Editor State & Embeds
export * from "./editor/index";

// External Adapters (Namespaced to avoid symbol collision)
export * as MediaWikiAdapter from "./adapters/mediawiki/index";
