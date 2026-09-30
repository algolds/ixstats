# next.config.js changes for the WikiOS standalone build

`next.config.js` is an untracked, server-local file, so these edits are applied by the operator on the
server (step 5 of `docs/operations/wikios-v1-cutover.md`). They are written against the copy in a
development checkout; the server's copy has the same `resolveBasePath()` shape as the IxWorld branch
at lines ~23-27.

`scripts/deploy-wikios.sh` builds with `NEXT_PUBLIC_WIKIOS_STANDALONE=true`, `BASE_PATH=` and
`NEXT_PUBLIC_BASE_PATH=` (all empty base path). Without edit 1 the production build would fall through to
`/projects/ixstates` and WikiOS would serve its assets from the wrong prefix.

## 1. Required: empty base path in `resolveBasePath()`

Add a WikiOS branch next to the IxWorld one, at the top of the function:

```js
const resolveBasePath = () => {
  // WikiOS standalone (ixwiki.com/wiki/*, plan 417): ALWAYS use an empty base path
  if (process.env.NEXT_PUBLIC_WIKIOS_STANDALONE === "true") {
    return "";
  }

  // If explicitly building for IxWorld standalone (maps.ixwiki.com), ALWAYS use empty base path
  if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
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
    // /projects/* rewrites, or the ixwiki.com proxy rewrite (src/proxy.ts redirects everything else).
    if (process.env.NEXT_PUBLIC_WIKIOS_STANDALONE === "true") {
      return [];
    }

    // ...rest of the function unchanged
  },
```

## 3. Required by the plan: drop the `/api/ixwiki-proxy` rewrite

In the same function, delete this entry from `baseRewrites`:

```js
      {
        source: "/api/ixwiki-proxy/:path*",
        destination: "https://ixwiki.com/:path*",
      },
```

Nothing under `src/` uses `/api/ixwiki-proxy` any more, and once `ixwiki.com/wiki/*` is WikiOS a
proxy from the app back to `https://ixwiki.com` would loop through nginx. This edit also affects the
IxStates build (same `next.config.js`), so redeploy IxStates afterwards with its usual deploy script.

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
