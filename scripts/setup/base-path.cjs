// The base path IxStates is served under, as next.config.js sets it: one rule for Next's `basePath` and for the
// PostCSS pass that puts it in front of the stylesheets' public-file URLs (postcss-base-path-urls.cjs).

/** `value` as a base path: a leading slash, no trailing one, "" for none. */
const normalizeBasePath = (value) => {
  if (!value) {
    return "";
  }
  let normalized = value.startsWith("/") ? value : `/${value}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

/**
 * "" for IxWorld standalone (maps.ixwiki.com); else BASE_PATH when it is set (even empty), else `/projects/ixstates`
 * in production and "" in development.
 */
const resolveBasePath = (env = process.env) => {
  if (env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
    return "";
  }
  const hasBasePathEnv = Object.prototype.hasOwnProperty.call(env, "BASE_PATH");
  const rawBasePath = hasBasePathEnv
    ? env.BASE_PATH
    : env.NODE_ENV === "production"
      ? "/projects/ixstates"
      : "";
  return normalizeBasePath(rawBasePath);
};

module.exports = { normalizeBasePath, resolveBasePath };
