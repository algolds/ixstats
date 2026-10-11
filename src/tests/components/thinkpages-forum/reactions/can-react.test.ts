/** @jest-environment node */
import {
  canReactToMessage,
  canReactToPost,
} from "~/components/thinkpages-forum/reactions/can-react";

describe("canReactToPost", () => {
  it("is the thread's verdict, narrowed to other members' visible posts", () => {
    expect(canReactToPost(true, { byViewer: false })).toBe(true);
    expect(canReactToPost(true, { byViewer: false, hidden: false })).toBe(true);
    expect(canReactToPost(true, { byViewer: true })).toBe(false);
    expect(canReactToPost(true, { byViewer: false, hidden: true })).toBe(false);
    expect(canReactToPost(false, { byViewer: false })).toBe(false);
  });
});

describe("canReactToMessage", () => {
  it("is the board's verdict, narrowed to another member's visible message", () => {
    expect(canReactToMessage(true, { byViewer: false })).toBe(true);
    expect(canReactToMessage(false, { byViewer: false })).toBe(false);
    expect(canReactToMessage(true, { byViewer: true })).toBe(false);
    expect(canReactToMessage(true, { byViewer: false, hidden: true })).toBe(false);
  });

  it("stays closed for an admin in an archived realm, whom the board's verdict already excludes", () => {
    // The board read says canReact: false there although canPost is true.
    expect(canReactToMessage(false, { byViewer: false, hidden: false })).toBe(false);
  });
});
