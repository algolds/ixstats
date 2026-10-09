/**
 * U1: a feed post shares with the same words wherever it is shared from (the feed's post actions, the dashboard
 * composer, the post page). The feed is IxStats; ThinkPages names the forum.
 */
import { describe, expect, it } from "@jest/globals";
import { feedShareCopy } from "~/lib/thinkpages/share-copy";

describe("feedShareCopy", () => {
  it("names IxStats, never ThinkPages", () => {
    expect(feedShareCopy("post")).toEqual({
      title: "IxStats post",
      text: "Check out this post on IxStats",
    });
    expect(feedShareCopy("reply")).toEqual({
      title: "IxStats reply",
      text: "Check out this reply on IxStats",
    });
  });
});
