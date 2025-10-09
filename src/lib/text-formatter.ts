// Text formatting utilities for SSR compatibility
// No external dependencies that use 'self' or browser globals

// Enhanced text formatting with better mention and hashtag styling
export function formatContentEnhanced(content: string): string {
  if (!content) return '';

  // Don't escape HTML - we'll be using dangerouslySetInnerHTML
  let formattedContent = content;

  // Replace URLs first (before hashtags and mentions to avoid conflicts)
  formattedContent = formattedContent.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>'
  );

  // Replace hashtags - match hashtag at word boundary
  formattedContent = formattedContent.replace(
    /\B#([a-zA-Z0-9_]+)/g,
    '<span class="text-blue-500 hover:underline cursor-pointer font-medium">#$1</span>'
  );

  // Replace mentions - match mention at word boundary
  formattedContent = formattedContent.replace(
    /\B@([a-zA-Z0-9_]+)/g,
    '<span class="text-purple-500 hover:underline cursor-pointer font-medium">@$1</span>'
  );

  return formattedContent;
}

// Extract hashtags from text
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map(tag => tag.slice(1)) : [];
}

// Extract mentions from text
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map(mention => mention.slice(1)) : [];
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