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
  it("needs board posting access, and another member's visible message", () => {
    expect(canReactToMessage({ canPost: true }, { byViewer: false })).toBe(true);
    expect(canReactToMessage({ canPost: false }, { byViewer: false })).toBe(false);
    expect(canReactToMessage({ canPost: true }, { byViewer: true })).toBe(false);
    expect(canReactToMessage({ canPost: true }, { byViewer: false, hidden: true })).toBe(false);
  });
});
