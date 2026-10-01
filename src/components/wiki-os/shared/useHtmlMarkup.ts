// src/components/wiki-os/shared/useHtmlMarkup.ts
// The `{ __html }` object of a `dangerouslySetInnerHTML` prop, built once per HTML string.
//
// React 19 writes an element's innerHTML again whenever the prop is a new object, even for the same string,
// so an inline `{ __html: html }` object rewrites the element (its images, its added links, a focused
// control inside it, a scroll position) on every render of its parent. One object per string leaves
// the DOM alone until the HTML itself changes.

import { useMemo } from "react";

export function useHtmlMarkup(html: string): { __html: string } {
  return useMemo(() => ({ __html: html }), [html]);
}
