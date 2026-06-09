// Text formatting utilities for SSR compatibility
// No external dependencies that use 'self' or browser globals

import { sanitizeUserContent, escapeHtml } from "./sanitize-html";

/** Convert Discord custom emoji markup <:name:id> and <a:name:id> to <img> tags. */
export function renderDiscordEmojis(html: string): string {
  return html.replace(
    /<(a)?:([a-zA-Z0-9_]+):(\d{17,20})>/g,
    (_match: string, animated: string, name: string, id: string) => {
      const ext = animated ? "gif" : "png";
      return `<img src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt=":${name}:" class="inline-block h-5 w-5 align-text-bottom" loading="lazy" />`;
    }
  );
}

// Enhanced text formatting with better mention and hashtag styling
export function formatContentEnhanced(content: string): string {
  if (!content) return "";

  // Extract Discord emoji markup BEFORE escaping HTML
  const discordEmojis: { placeholder: string; imgTag: string }[] = [];
  let placeholderIndex = 0;
  const withPlaceholders = content.replace(
    /<(a)?:([a-zA-Z0-9_]+):(\d{17,20})>/g,
    (_match: string, animated: string, name: string, id: string) => {
      const ext = animated ? "gif" : "png";
      const imgTag = `<img src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt=":${name}:" class="inline-block h-5 w-5 align-text-bottom" loading="lazy" />`;
      const placeholder = `\u0000EMOJI${placeholderIndex++}\u0000`;
      discordEmojis.push({ placeholder, imgTag });
      return placeholder;
    }
  );

  // SECURITY: Escape HTML to prevent XSS, then apply formatting
  let formattedContent = escapeHtml(withPlaceholders);

  // ── Discord Formatting Parser ──

  // Mask Markdown Links first so their URLs are not double-formatted
  const maskedLinks: string[] = [];
  let linkPlaceholderIndex = 0;
  formattedContent = formattedContent.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label, url) => {
      const placeholder = `\u0001LINK${linkPlaceholderIndex++}\u0001`;
      maskedLinks.push(
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-medium">${label}</a>`
      );
      return placeholder;
    }
  );

  // Parse Bold: **text**
  formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Parse Italic: *text*
  formattedContent = formattedContent.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Parse Underline: __text__
  formattedContent = formattedContent.replace(/__([^_]+)__/g, "<u>$1</u>");

  // Parse Strikethrough: ~~text~~
  formattedContent = formattedContent.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  // Parse Inline Code: `text`
  formattedContent = formattedContent.replace(
    /`([^`]+)`/g,
    '<code class="bg-black/30 px-1 py-0.5 rounded text-[11px] font-mono text-pink-400">$1</code>'
  );

  // Parse Blockquotes: > text
  formattedContent = formattedContent.replace(
    /(?:^|\n)&gt;\s*([^\n]+)/g,
    '<blockquote class="border-l-2 border-muted-foreground/30 pl-2 my-1 text-muted-foreground/90 italic">$1</blockquote>'
  );

  // Replace remaining raw URLs first (before hashtags and mentions to avoid conflicts)
  formattedContent = formattedContent.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>'
  );

  // Replace hashtags - match hashtag at word boundary, ignoring HTML entities like &#039;
  formattedContent = formattedContent.replace(
    /\B(?<!&)#([a-zA-Z0-9_]+)/g,
    '<span class="text-blue-500 hover:underline cursor-pointer font-medium">#$1</span>'
  );

  // Replace mentions - match mention at word boundary
  formattedContent = formattedContent.replace(
    /\B@([a-zA-Z0-9_]+)/g,
    '<span class="text-purple-500 hover:underline cursor-pointer font-medium">@$1</span>'
  );

  // Restore Markdown Links
  for (let i = 0; i < maskedLinks.length; i++) {
    formattedContent = formattedContent.replace(`\u0001LINK${i}\u0001`, maskedLinks[i]!);
  }

  // Restore Discord emoji images (they were protected from escaping)
  for (const { placeholder, imgTag } of discordEmojis) {
    formattedContent = formattedContent.replace(placeholder, imgTag);
  }

  // SECURITY: Final sanitization pass to ensure safe HTML
  return sanitizeUserContent(formattedContent);
}

/** Rich editor posts store HTML; legacy/plain posts are plain text with @/#/URLs. */
function looksLikeStoredHtml(content: string): boolean {
  return /<\/?(p|div|br|span|img|a|ul|ol|li|h[1-6]|strong|em|b|i|u|figure|section|article|pre|code|blockquote)\b/i.test(
    content
  );
}

/**
 * ThinkPages body: sanitize HTML from the rich editor, or run plain text through formatContentEnhanced.
 * Also converts Discord custom emoji markup <:name:id> and <a:name:id> to <img> tags.
 */
export function formatThinkpagesContentForDisplay(content: string): string {
  if (!content) return "";
  const clean = content.replace(/\s*\[DiscordMsg:\d+\]\s*$/, "");
  const t = clean.trim();
  if (looksLikeStoredHtml(t)) {
    // Convert Discord emoji markup in HTML content before sanitizing
    const withEmojis = renderDiscordEmojis(t);
    return sanitizeUserContent(withEmojis);
  }
  return formatContentEnhanced(t);
}

// Extract hashtags from text
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map((tag) => tag.slice(1)) : [];
}

// Extract mentions from text
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map((mention) => mention.slice(1)) : [];
}

// Validate if text contains valid URLs
export function containsUrls(text: string): boolean {
  if (!text) return false;
  const urlRegex = /https?:\/\/[^\s]+/g;
  return urlRegex.test(text);
}

// Extract URLs from text
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s]+/g;
  const matches = text.match(urlRegex);
  return matches || [];
}
