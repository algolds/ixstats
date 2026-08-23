// src/components/wiki-os/reader/AnnotationOverlay.tsx
// High-performance DOM highlighter for WikiOS article text annotations.
// Full Apple Design & Facet compliance.

"use client";

import { useEffect, useCallback, type RefObject } from "react";
import { soundEffects } from "~/lib/sound/cuelume";

export interface AnnotationItem {
  id: string;
  selectedText: string;
  comment?: string | null;
  color: string;
  createdAt?: string | Date;
}

interface UseAnnotationOverlayProps {
  contentRef: RefObject<HTMLDivElement | null>;
  annotations: AnnotationItem[];
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string) => void;
}

/**
 * Hook to automatically render interactive highlight marks on article text.
 */
export function useAnnotationOverlay({
  contentRef,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
}: UseAnnotationOverlayProps) {
  const handleMarkClick = useCallback(
    (id: string) => {
      soundEffects.press();
      onSelectAnnotation?.(id);
    },
    [onSelectAnnotation]
  );

  useEffect(() => {
    const container = contentRef.current;
    if (!container || typeof document === "undefined") return;

    // 1. Clear existing marks
    clearHighlights(container);

    if (!annotations || annotations.length === 0) return;

    // 2. Apply all annotations
    for (const ann of annotations) {
      applyHighlight(container, ann, handleMarkClick, selectedAnnotationId);
    }

    return () => {
      if (container) {
        clearHighlights(container);
      }
    };
  }, [annotations, contentRef, handleMarkClick, selectedAnnotationId]);

  // Update selected state dynamically without full re-render
  useEffect(() => {
    const container = contentRef.current;
    if (!container || typeof document === "undefined") return;

    const marks = container.querySelectorAll<HTMLElement>(".wikios-annotation-mark");
    marks.forEach((el) => {
      if (selectedAnnotationId && el.dataset.annotationId === selectedAnnotationId) {
        el.setAttribute("data-selected", "true");
      } else {
        el.removeAttribute("data-selected");
      }
    });
  }, [selectedAnnotationId, contentRef]);

  return null;
}

// ---------------------------------------------------------------------------
// DOM Highlights Helpers
// ---------------------------------------------------------------------------

export function clearHighlights(container: HTMLElement) {
  const marks = container.querySelectorAll(".wikios-annotation-mark");
  marks.forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
      parent.normalize();
    }
  });
}

export function applyHighlight(
  container: HTMLElement,
  annotation: AnnotationItem,
  onClick?: (id: string) => void,
  selectedAnnotationId?: string | null
) {
  if (!annotation.selectedText || annotation.selectedText.trim().length < 2) return;
  const rawSearch = annotation.selectedText.trim();
  const searchSnippet = rawSearch.length > 50 ? rawSearch.slice(0, 50) : rawSearch;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textContent = node.textContent ?? "";
    let idx = textContent.indexOf(rawSearch);
    let matchLength = rawSearch.length;

    if (idx === -1) {
      idx = textContent.indexOf(searchSnippet);
      matchLength = searchSnippet.length;
    }

    if (idx === -1) continue;

    // Skip if node is already inside a highlight mark
    if (node.parentElement?.closest(".wikios-annotation-mark")) continue;

    const parent = node.parentNode;
    if (!parent) continue;

    const beforeText = textContent.slice(0, idx);
    const matchText = textContent.slice(idx, idx + matchLength);
    const afterText = textContent.slice(idx + matchLength);

    const mark = document.createElement("mark");
    mark.className = "wikios-annotation-mark";
    mark.dataset.annotationId = annotation.id;
    if (selectedAnnotationId && annotation.id === selectedAnnotationId) {
      mark.dataset.selected = "true";
    }
    mark.style.setProperty("--annotation-color", annotation.color || "#fef036");
    mark.style.color = "inherit";
    mark.style.backgroundColor = "transparent";
    mark.textContent = matchText;
    mark.title = annotation.comment ? `"${annotation.comment}"` : "Highlight · Click to view in Margin";

    if (onClick) {
      mark.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick(annotation.id);
      });
    }

    const fragment = document.createDocumentFragment();
    if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
    fragment.appendChild(mark);
    if (afterText) fragment.appendChild(document.createTextNode(afterText));

    parent.replaceChild(fragment, node);
    break; // match applied
  }
}
