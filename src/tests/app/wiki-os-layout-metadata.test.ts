jest.mock("~/styles/wiki-os.css", () => ({}), { virtual: true });

import { metadata } from "~/app/(wiki-os)/wiki/layout";

describe("the WikiOS layout metadata", () => {
  it("brands every tab title and share card WikiOS, never IxWiki", () => {
    expect(metadata.title).toEqual({ template: "%s | WikiOS", default: "WikiOS" });
    expect(metadata.openGraph).toMatchObject({ siteName: "WikiOS" });
    expect(JSON.stringify(metadata)).not.toContain("IxWiki");
  });
});
