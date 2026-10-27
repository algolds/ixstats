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

/**
 * A board message: the board lets the viewer react (the board read's `canReact`: they may post there and the realm is
 * not archived), and the message is another member's and visible.
 */
export function canReactToMessage(
  boardCanReact: boolean,
  message: { byViewer: boolean; hidden?: boolean | undefined }
): boolean {
  return boardCanReact && !message.byViewer && message.hidden !== true;
}
