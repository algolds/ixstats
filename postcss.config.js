import basePathUrls from "./scripts/setup/postcss-base-path-urls.cjs";

export default {
  plugins: [
    "@tailwindcss/postcss",
    // after Tailwind, which inlines the @imported sheets (typography.css's @font-face URLs); a function, since
    // Turbopack resolves a plugin named by a path from its own build directory
    basePathUrls(),
  ],
};
