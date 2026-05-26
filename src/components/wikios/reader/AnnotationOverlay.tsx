// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wikios/reader/AnnotationOverlay.tsx
// Annotation system for stashed wiki pages.
// Renders highlights over article text + floating toolbar on text selection.

"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Highlighter, MessageSquare, X, Trash2, Check } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const HIGHLIGHT_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6"];

interface AnnotationData {
  id: string;
  anchorSelector: string;
  anchorOffset: number;
  focusSelector: string;
  focusOffset: number;
  selectedText: string;
  comment: string | null;
  color: string;
}

interface SelectionToolbarState {
  x: number;
  y: number;
  text: string;
  anchorSel: string;
  anchorOff: number;
  focusSel: string;
  focusOff: number;
}

// ---------------------------------------------------------------------------
// Hook: useAnnotationOverlay
// ---------------------------------------------------------------------------
export function useAnnotationOverlay(
  contentRef: RefObject<HTMLDivElement | null>,
  pageTitle: string,
  isAuthenticated: boolean,
  isStashed: boolean
) {
  const [annotationsOn, setAnnotationsOn] = useState(false);
  const [toolbar, setToolbar] = useState<SelectionToolbarState | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0]!);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // Ref mirror of toolbar so the mouseup handler can check without stale closure
  const toolbarOpenRef = useRef(false);

  const utils = api.useUtils();

  // Get the stash item ID for this page
  const stashQuery = api.wikios.isStashed.useQuery(
    { pageTitle },
    { enabled: isAuthenticated && isStashed }
  );
  const firstStash = stashQuery.data?.stashes?.[0];

  const itemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: firstStash?.id ?? "", limit: 100 },
    { enabled: !!firstStash?.id && annotationsOn }
  );
  const itemId = itemsQuery.data?.items.find((i) => i.pageTitle === pageTitle)?.id;

  const annotationsQuery = api.wikios.getAnnotations.useQuery(
    { pageTitle },
    { enabled: isAuthenticated && annotationsOn }
  );

  const addMutation = api.wikios.addAnnotation.useMutation({
    onSuccess: () => {
      utils.wikios.getAnnotations.invalidate({ pageTitle });
      closeToolbar();
    },
  });

  const deleteMutation = api.wikios.deleteAnnotation.useMutation({
    onSuccess: () => {
      utils.wikios.getAnnotations.invalidate({ pageTitle });
      setActiveAnnotation(null);
    },
  });

  const annotations = useMemo(() => annotationsQuery.data ?? [], [annotationsQuery.data]);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
    toolbarOpenRef.current = false;
    setCommentInput("");
  }, []);

  const openToolbar = useCallback((state: SelectionToolbarState) => {
    setToolbar(state);
    toolbarOpenRef.current = true;
  }, []);

  // Render highlights into the article DOM
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !annotationsOn) return;

    // Clear previous
    clearHighlights(container);

    // Apply each
    for (const ann of annotations) {
      applyHighlight(container, ann, (id) => setActiveAnnotation(id));
    }

    return () => {
      if (container) clearHighlights(container);
    };
  }, [annotations, annotationsOn, contentRef]);

  // Listen for text selection — stable handler, no toolbar in deps
  useEffect(() => {
    if (!annotationsOn || !isStashed) return;
    const container = contentRef.current;
    if (!container) return;

    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Ignore clicks inside the toolbar or popover
      if (target.closest(".wikios-annotation-toolbar")) return;
      if (target.closest(".wikios-annotation-popover")) return;

      // If toolbar is already open, don't replace it
      if (toolbarOpenRef.current) return;

      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) return;

        const text = sel.toString().trim();
        if (text.length < 3 || text.length > 2000) return;

        const rect = range.getBoundingClientRect();
        const anchorSel = buildSelector(range.startContainer, container);
        const focusSel = buildSelector(range.endContainer, container);

        openToolbar({
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
          text,
          anchorSel,
          anchorOff: range.startOffset,
          focusSel,
          focusOff: range.endOffset,
        });
      });
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [annotationsOn, isStashed, contentRef, openToolbar]);

  // Save annotation
  const handleSave = useCallback(() => {
    if (!toolbar || !itemId) return;

    addMutation.mutate({
      itemId,
      anchorSelector: toolbar.anchorSel,
      anchorOffset: toolbar.anchorOff,
      focusSelector: toolbar.focusSel,
      focusOffset: toolbar.focusOff,
      selectedText: toolbar.text,
      comment: commentInput || undefined,
      color: selectedColor,
    });
  }, [toolbar, itemId, commentInput, selectedColor, addMutation]);

  // Toggle button
  const toggleButton =
    isAuthenticated && isStashed ? (
      <button
        onClick={() => {
          setAnnotationsOn((v) => !v);
          closeToolbar();
          setActiveAnnotation(null);
        }}
        className={cn("wikios-toolbar-action", annotationsOn && "wikios-toolbar-action-active")}
        title={annotationsOn ? "Turn off markup mode" : "Turn on markup mode"}
      >
        <Highlighter size={13} />
        <span>Markup</span>
      </button>
    ) : null;

  // Selection toolbar portal — stays until explicitly closed
  const toolbarPortal = toolbar
    ? createPortal(
        <AnnotationToolbarUI
          ref={toolbarRef}
          x={toolbar.x}
          y={toolbar.y}
          selectedText={toolbar.text}
          commentInput={commentInput}
          onCommentChange={setCommentInput}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
          onSave={handleSave}
          onClose={closeToolbar}
          isSaving={addMutation.isPending}
        />,
        document.body
      )
    : null;

  // Active annotation popover portal
  const annotationPopover =
    activeAnnotation && annotations.find((a) => a.id === activeAnnotation)
      ? createPortal(
          <AnnotationPopover
            annotation={annotations.find((a) => a.id === activeAnnotation)!}
            onClose={() => setActiveAnnotation(null)}
            onDelete={() => deleteMutation.mutate({ id: activeAnnotation })}
            isDeleting={deleteMutation.isPending}
          />,
          document.body
        )
      : null;

  return { toggleButton, toolbarPortal, annotationPopover, annotationsOn };
}

// ---------------------------------------------------------------------------
// Annotation Toolbar — standalone component so it manages its own input focus
// ---------------------------------------------------------------------------
import { forwardRef } from "react";

const AnnotationToolbarUI = forwardRef<
  HTMLDivElement,
  {
    x: number;
    y: number;
    selectedText: string;
    commentInput: string;
    onCommentChange: (v: string) => void;
    selectedColor: string;
    onColorChange: (c: string) => void;
    onSave: () => void;
    onClose: () => void;
    isSaving: boolean;
  }
>(function AnnotationToolbarUI(props, ref) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    // Delay focus slightly so the toolbar is rendered first
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={ref}
      className="wikios-annotation-toolbar"
      style={{ left: props.x, top: props.y, transform: "translate(-50%, -100%)" }}
      // Prevent all mouse events from bubbling to the document handler
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="wikios-annotation-toolbar-preview">
        &ldquo;{props.selectedText.slice(0, 60)}
        {props.selectedText.length > 60 ? "..." : ""}&rdquo;
      </div>
      <div className="wikios-annotation-toolbar-colors">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => props.onColorChange(c)}
            className={cn(
              "wikios-annotation-color-btn",
              props.selectedColor === c && "wikios-annotation-color-active"
            )}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="wikios-annotation-toolbar-comment">
        <input
          ref={inputRef}
          type="text"
          value={props.commentInput}
          onChange={(e) => props.onCommentChange(e.target.value)}
          placeholder="Add a note (optional)..."
          className="wikios-annotation-comment-input"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") props.onSave();
            if (e.key === "Escape") props.onClose();
          }}
        />
      </div>
      <div className="wikios-annotation-toolbar-actions">
        <button onClick={props.onSave} className="wikios-annotation-save" disabled={props.isSaving}>
          <Check size={12} />
          {props.isSaving ? "Saving..." : "Highlight"}
        </button>
        <button onClick={props.onClose} className="wikios-annotation-cancel">
          <X size={12} />
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Annotation Popover
// ---------------------------------------------------------------------------
function AnnotationPopover({
  annotation,
  onClose,
  onDelete,
  isDeleting,
}: {
  annotation: AnnotationData;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const mark = document.querySelector(`[data-annotation-id="${annotation.id}"]`);
  const rect = mark?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.bottom + 6 : 200;

  return (
    <div
      ref={ref}
      className="wikios-annotation-popover"
      style={{ left: x, top: y, transform: "translateX(-50%)" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="wikios-annotation-popover-text">
        &ldquo;{annotation.selectedText.slice(0, 120)}
        {annotation.selectedText.length > 120 ? "..." : ""}&rdquo;
      </div>
      {annotation.comment && (
        <div className="wikios-annotation-popover-comment">
          <MessageSquare size={11} />
          {annotation.comment}
        </div>
      )}
      <div className="wikios-annotation-popover-actions">
        <button
          onClick={onDelete}
          className="wikios-annotation-popover-delete"
          disabled={isDeleting}
        >
          <Trash2 size={11} />
          {isDeleting ? "Removing..." : "Remove"}
        </button>
        <button onClick={onClose} className="wikios-annotation-popover-close">
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DOM Helpers
// ---------------------------------------------------------------------------

function clearHighlights(container: HTMLElement) {
  container.querySelectorAll(".wikios-annotation-mark").forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent ?? ""), el);
      parent.normalize();
    }
  });
}

function buildSelector(node: Node, container: HTMLElement): string {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  if (!el || !container.contains(el)) return "body";

  const heading = el.closest("[id]");
  if (heading && container.contains(heading)) {
    return `#${CSS.escape(heading.id)}`;
  }

  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== container) {
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName);
    const idx = siblings.indexOf(current);
    parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${idx + 1})`);
    current = parent;
  }
  return parts.join(" > ") || "body";
}

function applyHighlight(
  container: HTMLElement,
  annotation: AnnotationData,
  onClick: (id: string) => void
) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const searchText = annotation.selectedText;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textContent = node.textContent ?? "";
    const idx = textContent.indexOf(searchText);
    if (idx === -1) continue;

    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + searchText.length);

    const mark = document.createElement("mark");
    mark.className = "wikios-annotation-mark";
    mark.dataset.annotationId = annotation.id;
    mark.style.setProperty("--annotation-color", annotation.color);
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick(annotation.id);
    });

    try {
      range.surroundContents(mark);
    } catch {
      // surroundContents fails if range spans multiple elements
    }
    break;
  }
}
