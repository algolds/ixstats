/**
 * LoreTextArea Component
 * Rich text display for trading card lore content
 * Phase 1: Card Display Components
 */

"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * LoreTextArea component props
 */
export interface LoreTextAreaProps {
  /** Raw HTML or markdown content */
  content: string;
  /** Maximum character count before truncation */
  maxLength?: number;
  /** Enable expand/collapse functionality */
  expandable?: boolean;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Custom glass background opacity */
  glassOpacity?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Supported rich text elements for parsing
 */
interface ParsedElement {
  type: "text" | "bold" | "italic" | "heading" | "listItem" | "link";
  content: string;
  level?: number; // For headings (h1-h6)
  children?: ParsedElement[];
}

/**
 * Parse wiki markup/HTML to clean rich text structure
 * Supports: bold, italic, headings, lists, links (styled as text)
 */
function parseWikiMarkup(html: string): ParsedElement[] {
  const elements: ParsedElement[] = [];

  // Strip script tags for security
  let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Convert common wiki markup patterns
  cleanHtml = cleanHtml
    // Bold: '''text''' or **text** or <b>text</b>
    .replace(/'''([^']+)'''/g, "<strong>$1</strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Italic: ''text'' or *text* or <i>text</i>
    .replace(/''([^']+)''/g, "<em>$1</em>")
    .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>")
    // Headings: == text == or # text
    .replace(/==\s*([^=]+)\s*==/g, "<h3>$1</h3>")
    .replace(/^#\s+(.+)$/gm, "<h3>$1</h3>")
    // Links: [[text]] or [url text] - convert to styled text
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_, target, label) => `<span class="link-text">${label || target}</span>`
    )
    .replace(/\[([^\s]+)\s+([^\]]+)\]/g, '<span class="link-text">$2</span>')
    // Lists: * item or - item
    .replace(/^[\*\-]\s+(.+)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> elements in <ul>
  cleanHtml = cleanHtml.replace(/(<li>.*?<\/li>\s*)+/g, (match) => `<ul>${match}</ul>`);

  // Parse HTML to elements (simple parser)
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanHtml, "text/html");

  function parseNode(node: ChildNode): ParsedElement | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || "";
      return text ? { type: "text", content: text } : null;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      const children = Array.from(element.childNodes)
        .map(parseNode)
        .filter((n): n is ParsedElement => n !== null);

      switch (tagName) {
        case "strong":
        case "b":
          return { type: "bold", content: element.textContent || "", children };
        case "em":
        case "i":
          return { type: "italic", content: element.textContent || "", children };
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          return {
            type: "heading",
            content: element.textContent || "",
            level: parseInt(tagName.charAt(1)),
            children,
          };
        case "li":
          return { type: "listItem", content: element.textContent || "", children };
        case "span":
          if (element.className.includes("link-text")) {
            return { type: "link", content: element.textContent || "" };
          }
          return { type: "text", content: element.textContent || "" };
        case "p":
        case "div":
          return children.length > 0 ? children[0] : null;
        default:
          return { type: "text", content: element.textContent || "" };
      }
    }

    return null;
  }

  Array.from(doc.body.childNodes).forEach((node) => {
    const parsed = parseNode(node);
    if (parsed) elements.push(parsed);
  });

  return elements;
}

/**
 * Render parsed element to React component
 */
function renderElement(element: ParsedElement, index: number): React.ReactNode {
  switch (element.type) {
    case "bold":
      return (
        <strong key={index} className="font-bold text-white/95">
          {element.content}
        </strong>
      );
    case "italic":
      return (
        <em key={index} className="text-white/90 italic">
          {element.content}
        </em>
      );
    case "heading": {
      const level = element.level || 3;
      const headingSize = level === 1 ? "text-lg" : level === 2 ? "text-base" : "text-sm";
      const className = cn("font-bold text-white/95 mb-1", headingSize);

      return React.createElement(`h${level}`, { key: index, className }, element.content);
    }
    case "listItem":
      return (
        <li key={index} className="ml-4 list-disc text-xs text-white/85">
          {element.content}
        </li>
      );
    case "link":
      return (
        <span key={index} className="font-medium text-cyan-400 underline decoration-cyan-400/50">
          {element.content}
        </span>
      );
    case "text":
    default:
      return (
        <span key={index} className="text-white/85">
          {element.content}
        </span>
      );
  }
}

/**
 * Truncate text content to max length
 */
function truncateContent(
  elements: ParsedElement[],
  maxLength: number
): {
  truncated: ParsedElement[];
  isTruncated: boolean;
} {
  let charCount = 0;
  const truncated: ParsedElement[] = [];
  let isTruncated = false;

  for (const element of elements) {
    const elementLength = element.content.length;

    if (charCount + elementLength <= maxLength) {
      truncated.push(element);
      charCount += elementLength;
    } else {
      // Truncate this element
      const remaining = maxLength - charCount;
      if (remaining > 0) {
        truncated.push({
          ...element,
          content: element.content.substring(0, remaining) + "...",
        });
      }
      isTruncated = true;
      break;
    }
  }

  return { truncated, isTruncated };
}

/**
 * LoreTextArea - Rich text display for card lore
 *
 * Features:
 * - Parses wiki markup/HTML to clean rich text
 * - Supports bold, italic, headings, lists, links (styled text)
 * - Character limit with truncation
 * - Expand/collapse for long content
 * - Glass physics background
 * - Smooth scroll animations
 *
 * @example
 * ```tsx
 * <LoreTextArea
 *   content="<b>The Ancient Kingdom</b> was founded in '''1204'''..."
 *   maxLength={400}
 *   expandable
 * />
 * ```
 */
export const LoreTextArea = React.memo<LoreTextAreaProps>(
  ({
    content,
    maxLength = 400,
    expandable = true,
    defaultExpanded = false,
    glassOpacity = 20,
    className,
  }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Parse content
    const parsedElements = useMemo(() => parseWikiMarkup(content), [content]);

    // Truncate if needed
    const { truncated, isTruncated } = useMemo(() => {
      if (isExpanded || !expandable) {
        return { truncated: parsedElements, isTruncated: false };
      }
      return truncateContent(parsedElements, maxLength);
    }, [parsedElements, maxLength, isExpanded, expandable]);

    const shouldShowToggle = expandable && isTruncated;

    return (
      <motion.div
        className={cn(
          // Glass physics background
          "relative overflow-hidden rounded-lg",
          `bg-black/${glassOpacity}`,
          "backdrop-blur-sm",
          "border border-white/10",
          // Padding and spacing
          "p-3",
          className
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Scrollable content area */}
        <motion.div
          className={cn(
            "relative",
            // Scrollable when expanded
            isExpanded && "max-h-64 overflow-y-auto pr-2",
            // Custom scrollbar styling
            "scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent",
            "[&::-webkit-scrollbar]:w-1",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-white/20",
            "[&::-webkit-scrollbar-track]:bg-transparent"
          )}
          layout
          transition={{ duration: 0.3 }}
        >
          {/* Rich text content */}
          <div className="space-y-1.5 text-xs leading-relaxed">
            {truncated.map((element, index) => renderElement(element, index))}
          </div>
        </motion.div>

        {/* Expand/Collapse button */}
        <AnimatePresence>
          {shouldShowToggle && (
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                // Position at bottom
                "mt-2 flex w-full items-center justify-center gap-1",
                // Glass button styling
                "rounded-md px-3 py-1.5",
                "bg-white/5 hover:bg-white/10",
                "border border-white/10",
                "backdrop-blur-sm",
                // Typography
                "text-xs font-medium text-white/70 hover:text-white/90",
                // Transitions
                "transition-all duration-200",
                // Focus states
                "focus:ring-2 focus:ring-white/20 focus:outline-none"
              )}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isExpanded ? (
                <>
                  <span>Show Less</span>
                  <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  <span>Read More</span>
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Gradient overlay when collapsed */}
        {!isExpanded && isTruncated && (
          <motion.div
            className={cn(
              "absolute right-0 bottom-0 left-0 h-12",
              "bg-gradient-to-t from-black/40 to-transparent",
              "pointer-events-none"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </motion.div>
    );
  }
);

LoreTextArea.displayName = "LoreTextArea";
