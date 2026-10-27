// A PostCSS plugin: the stylesheets' URLs of public files (`url("/fonts/…")`) get the base path in front, so under
// production's `/projects/ixstates` the fonts load from IxStates, not from the site root. Next.js leaves a
// root-relative `url()` as it is written, and serves public files under the base path.

const { resolveBasePath } = require("./base-path.cjs");

/** The root-relative public directory whose `url()`s are rewritten: `/fonts/`. */
const PUBLIC_URL = /url\(\s*(["']?)\/(fonts\/)/g;

/** @param {{ basePath?: string }} [options] the base path; next.config.js's rule when not given */
const plugin = (options = {}) => {
  const basePath = options.basePath ?? resolveBasePath();
  return {
    postcssPlugin: "base-path-urls",
    Declaration(decl) {
      if (!basePath || !decl.value.includes("url(")) return;
      const value = decl.value.replace(PUBLIC_URL, `url($1${basePath}/$2`);
      if (value !== decl.value) decl.value = value;
    },
  };
};
plugin.postcss = true;

module.exports = plugin;
