// src/lib/wiki-os/transformers/inert-dom.ts
// Parse article HTML into an inert DOM fragment, to change it with DOM APIs instead of regexes.
//
// The HTML the reader holds is already sanitized, and string surgery on sanitized HTML is not safe:
// the sanitizer's serializer leaves `<` and `>` unescaped inside attribute values, so a regex that
// looks for `<a ...>(.*?)</a>` or a matching `</div>` can be made to end inside an attribute and
// publish the rest of it as live markup. The DOM cannot be fooled that way.
//
// The fragment is a <template>'s content: nothing in it loads, runs or fires an event handler, and
// that holds only while it stays there. Nodes are made in the template's own (inert) document and
// the result is serialized with `template.innerHTML`; nothing is ever adopted into the live page.

export interface InertFragment {
  /** Serialize with `template.innerHTML`. */
  template: HTMLTemplateElement;
  /** The fragment's own inert document: create new nodes here, never in the live `document`. */
  document: Document;
  content: DocumentFragment;
}

/** `html` parsed inertly, or null when there is no DOM (outside a browser). */
export function parseInert(html: string): InertFragment | null {
  if (typeof document === "undefined") return null;
  const template = document.createElement("template");
  template.innerHTML = html;
  return { template, document: template.content.ownerDocument, content: template.content };
}
