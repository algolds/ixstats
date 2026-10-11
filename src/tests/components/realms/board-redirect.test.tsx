/**
 * /r/[realm]/board sends the visitor to the realm's live board (sub-project 7; it was the Hub before the board existed).
 */
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

import { redirect } from "next/navigation";
import RealmBoardPage from "~/app/r/[realm]/(region)/board/page";

describe("/r/[realm]/board", () => {
  beforeEach(() => jest.mocked(redirect).mockClear());

  it("redirects to the realm's live board", async () => {
    await RealmBoardPage({ params: Promise.resolve({ realm: "eurth" }) });
    expect(redirect).toHaveBeenCalledWith("/thinkpages/r/eurth");
  });

  it("encodes the slug", async () => {
    await RealmBoardPage({ params: Promise.resolve({ realm: "a/b c" }) });
    expect(redirect).toHaveBeenCalledWith("/thinkpages/r/a%2Fb%20c");
  });
});
