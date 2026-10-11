/** @jest-environment node */
import { isValidElement } from "react";

jest.mock("~/components/thinkpages-forum/advert", () => ({ NewAdvertForm: jest.fn() }));
jest.mock("~/app/thinkpages/_lib/require-sign-in", () => ({ requireSignIn: jest.fn() }));

import NewAdvertPage from "~/app/thinkpages/c/find-a-realm/new/page";
import { requireSignIn } from "~/app/thinkpages/_lib/require-sign-in";
import { NewAdvertForm } from "~/components/thinkpages-forum/advert";

describe("the new advert route", () => {
  beforeEach(() => jest.mocked(requireSignIn).mockClear());

  it("sends a signed-out visitor to sign-in and back to the same realm's form", async () => {
    await NewAdvertPage({ searchParams: Promise.resolve({ advert: "eurth" }) });
    expect(requireSignIn).toHaveBeenCalledWith("/thinkpages/c/find-a-realm/new?advert=eurth");
  });

  it("returns to the plain form when no realm is named", async () => {
    await NewAdvertPage({ searchParams: Promise.resolve({}) });
    expect(requireSignIn).toHaveBeenCalledWith("/thinkpages/c/find-a-realm/new");
  });

  it("opens the form on the named realm, the first when repeated", async () => {
    const page = await NewAdvertPage({
      searchParams: Promise.resolve({ advert: ["eurth", "zeta"] }),
    });
    expect(isValidElement(page) && page.type).toBe(NewAdvertForm);
    expect(isValidElement(page) && page.props).toEqual({ realm: "eurth" });
  });
});
