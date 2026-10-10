/** @jest-environment node */
import { boardQuoteText } from "~/components/thinkpages-forum/realm/board-quote";

describe("boardQuoteText", () => {
  it("quotes the author and the words of the message", () => {
    expect(boardQuoteText("kir", "<p>Anyone up for <b>exercises</b>?</p>")).toBe(
      'kir wrote: "Anyone up for exercises?" '
    );
  });

  it("leaves out earlier quotes, action tokens and markup", () => {
    const html =
      '<blockquote class="forum-quote"><div>old</div></blockquote><p>Done.</p>[ixaction=a1]';
    expect(boardQuoteText("urcea", html)).toBe('urcea wrote: "Done." ');
  });

  it("shortens a long message to a short passage", () => {
    const quote = boardQuoteText("kir", `<p>${"word ".repeat(100)}</p>`);
    expect(quote.length).toBeLessThan(180);
    expect(quote).toContain("…");
  });

  it("has nothing to quote in a message that is only an action card", () => {
    expect(boardQuoteText("kir", "[ixaction=a1]")).toBeNull();
  });
});
