/**
 * D6: a realm's old board page is gone; /r/[realm]/board sends the visitor to the realm's forum Hub.
 */
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

import { redirect } from "next/navigation";
import RealmBoardPage from "~/app/r/[realm]/(region)/board/page";

describe("/r/[realm]/board", () => {
  beforeEach(() => jest.mocked(redirect).mockClear());

  it("redirects to the realm's Hub", async () => {
    await RealmBoardPage({ params: Promise.resolve({ realm: "eurth" }) });
    expect(redirect).toHaveBeenCalledWith("/thinkpages/r/eurth/hub");
  });

  it("encodes the slug", async () => {
    await RealmBoardPage({ params: Promise.resolve({ realm: "a/b c" }) });
    expect(redirect).toHaveBeenCalledWith("/thinkpages/r/a%2Fb%20c/hub");
  });
});
