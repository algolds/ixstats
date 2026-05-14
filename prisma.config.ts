import { defineConfig } from "@prisma/config";

// Note: Prisma 6 CLI does not automatically load .env files when using prisma.config.ts
// but this project uses bun and existing scripts that handle environment variables.
// We keep it simple to match the previous package.json configuration.

export default defineConfig({
  schema: "prisma/schema",
});
