// src/lib/wiki-os/transformers/server-dom.ts
// `parseInert` for the server: the same inert <template> fragment (see inert-dom.ts), from one jsdom
// window created on first use (the sanitizer already depends on jsdom there). Server modules only:
// the browser has its own `document`, and must never bundle jsdom.

import type { InertFragment } from "./inert-dom";

let serverDocument: Document | null = null;

export function parseInertOnServer(html: string): InertFragment {
  if (!serverDocument) {
    const { JSDOM } = require("jsdom") as typeof import("jsdom");
    serverDocument = new JSDOM("").window.document;
  }
  const template = serverDocument.createElement("template");
  template.innerHTML = html;
  return { template, document: template.content.ownerDocument, content: template.content };
}
