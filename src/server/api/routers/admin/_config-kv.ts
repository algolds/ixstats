// Moved to src/server/shared/config-kv.ts so routers outside admin/ can use it without a
// cross-router import; admin routers keep importing it from here.
export * from "~/server/shared/config-kv";
