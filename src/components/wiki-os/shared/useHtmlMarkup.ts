// src/components/wiki-os/shared/useHtmlMarkup.ts
// The `{ __html }` object of a `dangerouslySetInnerHTML` prop, built once per HTML string.
//
// React 19 writes an element's innerHTML again whenever the prop is a new object, even for the same string,
// so an inline `{ __html: html }` object rewrites the element (its images, its added links, a focused
// control inside it, a scroll position) on every render of its parent. One object per string leaves
// the DOM alone until the HTML itself changes.
//
// The HTML's root-relative app links (`/wiki/…`, `/dashboard/…`, `/@…`) get the deployment's base path here
// (`withAppHrefs`): WikiOS stores them without it.

import { useMemo } from "react";
import { withAppHrefs } from "~/lib/wiki-os/reader-hrefs";

export function useHtmlMarkup(html: string): { __html: string } {
  return useMemo(() => ({ __html: withAppHrefs(html) }), [html]);
}
