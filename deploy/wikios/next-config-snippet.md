# next.config.js and base-path changes for the WikiOS standalone build

`next.config.js` is tracked in git, and it does not carry these edits yet. They belong to the deferred
ixwiki.com takeover build (deferred step T5 of `docs/history/operations/wikios-v1-cutover.md`), which the IxStates-only launch
does not run. Make them in a commit before that build, not by hand on the server: `scripts/deploy-production.sh`
runs `git reset --hard` and `git clean -fd` in the production checkout, so a hand edit there is undone by the next
IxStates deploy. Edit 1 goes beside the IxWorld branch at the top of `resolveBasePath()`, which lives in
`scripts/setup/base-path.cjs` (next.config.js imports it). The PostCSS pass that puts the base path in front of the
stylesheets' font URLs (`scripts/setup/postcss-base-path-urls.cjs`) calls the same function, so the edit covers it too.

`scripts/deploy-wikios.sh` builds with `NEXT_PUBLIC_WIKIOS_STANDALONE=true`, `BASE_PATH=` and
`NEXT_PUBLIC_BASE_PATH=` (all empty base path). Without edit 1 the production build would fall through to
`/projects/ixstates` whenever `BASE_PATH` is not exported, and WikiOS would serve its assets (and its stylesheets'
fonts) from the wrong prefix.

## 1. Required: empty base path in `resolveBasePath()` (`scripts/setup/base-path.cjs`)

Add a WikiOS branch next to the IxWorld one, at the top of the function (it reads `env`, `process.env` by default):

```js
const resolveBasePath = (env = process.env) => {
  // WikiOS standalone (ixwiki.com/wiki/*, plan 417): ALWAYS use an empty base path
  if (env.NEXT_PUBLIC_WIKIOS_STANDALONE === "true") {
    return "";
  }
  if (env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
    return "";
  }

  // ...rest of the function unchanged
};
```

Result: `basePath = ""` and `assetPrefix = undefined`, so `/_next/static/...` is served from the site root,
which is exactly what the nginx `location ^~ /_next/` block in `scripts/ops/nginx/wikios-takeover.conf`
proxies to WikiOS.

## 2. Recommended: no IxStates rewrites in the WikiOS build

At the top of `rewrites()`, before `passportRewrites` is used:

```js
  async rewrites() {
    // WikiOS standalone owns only /wiki/* and its own assets: no IxStates passport rewrites,
    // /projects/* rewrites (src/proxy.ts redirects everything else).
    if (process.env.NEXT_PUBLIC_WIKIOS_STANDALONE === "true") {
      return [];
    }

    // ...rest of the function unchanged
  },
```

## Check (no build needed)

`next.config.js` is an ES module with top-level `await`, so load it with a dynamic `import()` (run from the
IxStats checkout on the server):

```bash
NODE_ENV=production NEXT_PUBLIC_WIKIOS_STANDALONE=true node --input-type=module -e \
  'const { default: c } = await import("./next.config.js"); console.log(JSON.stringify(c.basePath), c.assetPrefix)'
# expect:  "" undefined

NODE_ENV=production node --input-type=module -e \
  'const { default: c } = await import("./next.config.js"); console.log(JSON.stringify(c.basePath), c.assetPrefix)'
# IxStates build is unchanged, expect:  "/projects/ixstates" /projects/ixstates
```
