/** @jest-environment node */
import { boardQuoteText } from "~/components/thinkpages-forum/realm/board-quote";

describe("boardQuoteText", () => {
  it("leaves out earlier quotes, action tokens and markup", () => {
    const html =
      '<blockquote class="forum-quote"><div>old</div></blockquote><p>Done.</p>[ixaction=a1]';
    expect(boardQuoteText("urcea", html)).toBe('urcea wrote: "Done." ');
  });
  it("has nothing to quote in a message that is only an action card", () => {
    expect(boardQuoteText("kir", "[ixaction=a1]")).toBeNull();
  });
});
