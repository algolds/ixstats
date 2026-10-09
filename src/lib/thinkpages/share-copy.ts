/**
 * The share sheet's title and text for a feed post (U1). The feed is IxStats; ThinkPages names the forum. One
 * source so the feed, the dashboard and the post page share a post with the same words.
 */
export function feedShareCopy(kind: "post" | "reply"): { title: string; text: string } {
  return { title: `IxStats ${kind}`, text: `Check out this ${kind} on IxStats` };
}
