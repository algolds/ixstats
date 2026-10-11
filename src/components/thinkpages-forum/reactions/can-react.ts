/**
 * Which posts show the React button. The server decides (and asks again on every write); these only narrow the
 * thread's or the board's verdict to the post at hand so the UI offers what will be accepted: not your own post, not a
 * hidden one a moderator is reading.
 */

/** A thread post: the thread lets the viewer react, and the post is another member's and visible. */
export function canReactToPost(
  threadCanReact: boolean,
  post: { byViewer: boolean; hidden?: boolean | undefined }
): boolean {
  return threadCanReact && !post.byViewer && post.hidden !== true;
}

/** A board message: the viewer may post on the board, and the message is another member's and visible. */
export function canReactToMessage(
  access: { canPost: boolean },
  message: { byViewer: boolean; hidden?: boolean | undefined }
): boolean {
  return access.canPost && !message.byViewer && message.hidden !== true;
}
