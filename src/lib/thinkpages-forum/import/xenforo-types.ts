/**
 * The XenForo 2.2 REST shapes the phase 4 export keeps (ThinkPages forum import). The export picks these fields
 * out of each API response, so a snapshot holds only what the importer reads (no avatars, no nested User rows).
 */

export interface XfNode {
  node_id: number;
  title: string;
  description: string;
  node_type_id: string;
  parent_node_id: number;
  display_order: number;
  type_data?: { discussion_count?: number; message_count?: number };
}

export interface XfThread {
  thread_id: number;
  node_id: number;
  title: string;
  user_id: number;
  username: string;
  post_date: number;
  last_post_date: number;
  reply_count: number;
  view_count: number;
  first_post_id: number;
  discussion_open: boolean;
  sticky: boolean;
  discussion_state: string;
  discussion_type?: string;
  prefix_id: number;
}

export interface XfAttachment {
  attachment_id: number;
  filename: string;
  file_size: number;
  content_type: string;
  width?: number;
  height?: number;
}

export interface XfPost {
  post_id: number;
  thread_id: number;
  user_id: number;
  username: string;
  post_date: number;
  last_edit_date?: number;
  message: string;
  message_state: string;
  position: number;
  attach_count: number;
  is_first_post: boolean;
  Attachments?: XfAttachment[];
}

export interface XfUserLite {
  user_id: number;
  username: string;
  register_date: number;
  is_staff: boolean;
  message_count: number;
}

export interface XfPagination {
  current_page: number;
  last_page: number;
  total: number;
}

/** GET /index: the API key's own description. */
export interface XfIndexResponse {
  key?: { type?: string; allow_all_scopes?: boolean; scopes?: string[] };
}

export interface XfNodesResponse {
  nodes: XfNode[];
}

/** GET /forums/{id}/threads: page 1 may carry the sticky threads in their own list. */
export interface XfThreadsResponse {
  threads: XfThread[];
  sticky?: XfThread[];
  pagination?: XfPagination;
}

export interface XfPostsResponse {
  posts: XfPost[];
  pagination?: XfPagination;
}

export interface XfUserResponse {
  user: XfUserLite;
}
