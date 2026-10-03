// Normalizers from XenForo REST payloads to the shapes the forum routers return.

import type { XFForum, XFPost, XFThread } from "~/server/modules/forum";
import { transformBBCode } from "~/server/modules/forum";

interface ForumNode {
  nodeId: number;
  title: string;
  description: string;
  parentNodeId: number;
  displayOrder: number;
  threadCount: number;
  messageCount: number;
  lastPostDate: number | null;
  lastPostUsername: string | null;
  lastThreadTitle: string | null;
  lastThreadId: number | null;
  nodeType: string;
}

interface NormalizedThread {
  threadId: number;
  nodeId: number;
  title: string;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  postDate: number;
  replyCount: number;
  viewCount: number;
  lastPostDate: number;
  lastPostUsername: string;
  isSticky: boolean;
  isOpen: boolean;
  forumName: string | null;
}

interface NormalizedPost {
  postId: number;
  threadId: number;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  authorTitle: string | null;
  authorMessageCount: number;
  authorReactionScore: number;
  authorJoinDate: number;
  postDate: number;
  contentHtml: string;
  message: string;
  isFirstPost: boolean;
  reactionScore: number;
  position: number;
  attachments: Array<{
    id: number;
    filename: string;
    fileSize: number;
    thumbnailUrl: string | null;
    directUrl: string | null;
    contentType: string;
    width: number | null;
    height: number | null;
  }>;
}

export function normalizeThread(t: XFThread): NormalizedThread {
  return {
    threadId: t.thread_id,
    nodeId: t.node_id,
    title: t.title,
    authorId: t.user_id,
    authorName: t.username,
    authorAvatar: t.User?.avatar_urls?.l ?? t.User?.avatar_urls?.m ?? null,
    postDate: t.post_date,
    replyCount: t.reply_count,
    viewCount: t.view_count,
    lastPostDate: t.last_post_date,
    lastPostUsername: t.last_post_username,
    isSticky: t.sticky,
    isOpen: t.discussion_open,
    forumName: t.Forum?.title ?? null,
  };
}

export function normalizePost(p: XFPost): NormalizedPost {
  // Prefer XenForo's pre-rendered HTML (message_parsed) over our BBCode transformer.
  // XenForo handles attachments, mentions, media embeds, and custom BB codes natively.
  const rawPost = p as any; // XF API may include message_parsed
  let contentHtml: string;

  if (rawPost.message_parsed) {
    // Use XenForo's rendered HTML — rewrite internal URLs to /forum/ routes
    contentHtml = rewriteXFHtml(rawPost.message_parsed);
  } else {
    // Fallback: transform BBCode ourselves
    const transformed = transformBBCode(p.message);
    contentHtml = transformed.contentHtml;
  }

  return {
    postId: p.post_id,
    threadId: p.thread_id,
    authorId: p.user_id,
    authorName: p.username,
    authorAvatar: p.User?.avatar_urls?.l ?? p.User?.avatar_urls?.m ?? null,
    authorTitle: p.User?.user_title ?? null,
    authorMessageCount: p.User?.message_count ?? 0,
    authorReactionScore: p.User?.reaction_score ?? 0,
    authorJoinDate: p.User?.register_date ?? 0,
    postDate: p.post_date,
    contentHtml,
    message: p.message,
    isFirstPost: p.is_first_post,
    reactionScore: p.reaction_score,
    position: p.position,
    attachments: (p.Attachments ?? []).map((a) => ({
      id: a.attachment_id,
      filename: a.filename,
      fileSize: a.file_size,
      thumbnailUrl: a.thumbnail_url ?? null,
      directUrl: a.direct_url ?? null,
      contentType: a.content_type,
      width: a.width ?? null,
      height: a.height ?? null,
    })),
  };
}

/** Rewrite XenForo's rendered HTML: fix internal links, handle images properly */
function rewriteXFHtml(html: string): string {
  let result = html;

  // --- Link rewrites ---

  // Thread links: /threads/slug.123/ → /forum/thread/123
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/threads\/[^"]*?\.(\d+)\/?"/g,
    'href="/forum/thread/$1"'
  );
  // Also handle /threads/123/ without slug
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/threads\/(\d+)\/?"/g,
    'href="/forum/thread/$1"'
  );
  // Post links: /posts/123/ → anchor within page
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/posts\/(\d+)\/?"/g,
    'href="#post-$1"'
  );
  // Member links: /members/name.123/ → /forum/members/123
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/members\/[^"]*?\.(\d+)\/?"/g,
    'href="/forum/members/$1"'
  );
  // Forum links: /forums/slug.123/ → /forum/123
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/forums\/[^"]*?\.(\d+)\/?"/g,
    'href="/forum/$1"'
  );
  // Attachment download links: keep as external
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/attachments\/([^"]*)"/g,
    'href="https://forum.ixwiki.com/attachments/$1" target="_blank" rel="noopener noreferrer"'
  );

  // --- Image handling ---

  // Add referrerpolicy to prevent hotlink blocking (same pattern as WikiOS)
  result = result.replace(/<img(?![^>]*referrerpolicy)/g, '<img referrerpolicy="no-referrer"');

  // Add lazy loading to images that don't have it
  result = result.replace(/<img(?![^>]*loading=)/g, '<img loading="lazy"');

  // Add decoding="async" for better rendering
  result = result.replace(/<img(?![^>]*decoding=)/g, '<img decoding="async"');

  // Add forum-img class for proper styling (responsive max-width)
  result = result.replace(/<img(?![^>]*class="[^"]*forum-img)/g, '<img class="forum-img"');

  // XenForo wraps attachment images in <a> — make the images clickable/expandable
  // Fix attachment URLs that use relative paths
  result = result.replace(/src="\/data\//g, 'src="https://forum.ixwiki.com/data/');
  result = result.replace(/srcset="\/data\//g, 'srcset="https://forum.ixwiki.com/data/');
  // Fix srcset entries that have relative paths after commas
  result = result.replace(/srcset="([^"]*?)\/data\//g, 'srcset="$1https://forum.ixwiki.com/data/');

  // --- Element class enhancements ---
  result = result.replace(/<blockquote(?![^>]*class)/g, '<blockquote class="forum-quote"');
  result = result.replace(/<pre(?![^>]*class)/g, '<pre class="forum-code"');

  return result;
}

export function normalizeNode(n: XFForum): ForumNode {
  return {
    nodeId: n.node_id,
    title: n.title,
    description: n.description,
    parentNodeId: n.parent_node_id,
    displayOrder: n.display_order,
    threadCount: n.type_data?.discussion_count ?? 0,
    messageCount: n.type_data?.message_count ?? 0,
    lastPostDate: n.type_data?.last_post_date ?? null,
    lastPostUsername: n.type_data?.last_post_username ?? null,
    lastThreadTitle: n.type_data?.last_thread_title ?? null,
    lastThreadId: n.type_data?.last_thread_id ?? null,
    nodeType: n.node_type_id,
  };
}
