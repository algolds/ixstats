"use client";

import { useEffect, useMemo } from "react";
import { EMBED_CSS, EMBED_JS, EMBED_PREFETCH } from "~/lib/wiki-os/editor/wiki-embed-shared";
import { ixstatesHref } from "~/lib/system/wikios-standalone";

/** An embed is a `.ix-embed-wrap` block (the class EMBED_CSS styles); only pages with one need the embed assets. */
const EMBED_MARKER = "ix-embed-wrap";

function ensureInHead(id: string, create: () => HTMLElement) {
  if (document.getElementById(id)) return;
  const el = create();
  el.id = id;
  document.head.appendChild(el);
}

/**
 * Injects the shared embed CSS + JS (and warms the /maps page they frame) once, and only for an
 * article whose body or infobox embeds a map.
 */
export function useEmbedAssets(contentHtml: string, infoboxHtml: string | null | undefined) {
  const hasEmbeds = useMemo(
    () => contentHtml.includes(EMBED_MARKER) || Boolean(infoboxHtml?.includes(EMBED_MARKER)),
    [contentHtml, infoboxHtml]
  );

  useEffect(() => {
    if (!hasEmbeds || typeof document === "undefined") return;

    ensureInHead("ixstats-embed-css", () => {
      const style = document.createElement("style");
      style.textContent = EMBED_CSS;
      return style;
    });
    ensureInHead("ixstats-embed-js", () => {
      const script = document.createElement("script");
      // The embed iframes load /maps, an IxStates route (another host in the standalone wiki).
      script.textContent = EMBED_JS.replace(
        `'${EMBED_PREFETCH}'`,
        JSON.stringify(ixstatesHref(EMBED_PREFETCH))
      );
      // The CSP carries a per-request nonce, so an inline script only runs if it carries it too.
      const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
      if (nonce) script.nonce = nonce;
      return script;
    });
    ensureInHead("ixstats-embed-prefetch", () => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = ixstatesHref(EMBED_PREFETCH);
      link.setAttribute("as", "document");
      return link;
    });
  }, [hasEmbeds]);
}
