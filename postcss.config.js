import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The base-path pass as an absolute path: Next's webpack loader takes only a plugin's name or path (an object or a
// function is refused), and Turbopack requires a relative one from its own build directory, so "./scripts/…" fails
// there. Both take an absolute path, and call it with no options (the base path then follows
// scripts/setup/base-path.cjs). Turbopack requires it outside its module graph, so after editing either .cjs clear
// .next/dev/cache before the next dev run, or its cached CSS may still come from the old pass.
const basePathUrls = join(
  dirname(fileURLToPath(import.meta.url)),
  "scripts/setup/postcss-base-path-urls.cjs"
);

export default {
  plugins: [
    "@tailwindcss/postcss",
    // after Tailwind, which inlines the @imported sheets (typography.css's @font-face URLs)
    basePathUrls,
  ],
};
