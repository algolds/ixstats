import fs from "node:fs";
import path from "node:path";
import { isValidElement } from "react";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("~/components/thinkpages-forum/realm", () => ({ RealmLanding: jest.fn() }));

import { redirect } from "next/navigation";
import { RealmLanding } from "~/components/thinkpages-forum/realm";
import RealmPage from "~/app/thinkpages/r/[realm]/page";

describe("/thinkpages/r/<realm>", () => {
  it("is the realm's landing page, not a redirect to its Hub", async () => {
    const page = await RealmPage({ params: Promise.resolve({ realm: "eurth" }) });
    expect(isValidElement(page) && page.type).toBe(RealmLanding);
    expect(isValidElement(page) && page.props).toEqual({ realm: "eurth" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("passes the slug as the URL gave it", async () => {
    const page = await RealmPage({ params: Promise.resolve({ realm: "a b" }) });
    expect(isValidElement(page) && page.props).toEqual({ realm: "a b" });
  });

  it("has no loading.tsx beside it", () => {
    const dir = path.join(process.cwd(), "src/app/thinkpages/r/[realm]");
    expect(fs.readdirSync(dir)).not.toContain("loading.tsx");
  });
});
