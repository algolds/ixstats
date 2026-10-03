import { toReaderAuthorInfo } from "~/components/wiki-os/reader/toReaderAuthorInfo";

describe("toReaderAuthorInfo", () => {
  it("falls back to author when creator is null or missing", () => {
    expect(toReaderAuthorInfo({ creator: null, author: "Ada" }).creator).toBe("Ada");
    expect(toReaderAuthorInfo({ author: "Ada" }).creator).toBe("Ada");
  });

  it("falls back from a null lastEditor only to null (nothing else to use)", () => {
    expect(toReaderAuthorInfo({ lastEditor: null }).lastEditor).toBeNull();
  });

  it("uses a creator name, or an object's username", () => {
    expect(toReaderAuthorInfo({ creator: "Bob", author: "Ada" }).creator).toBe("Bob");
    expect(toReaderAuthorInfo({ creator: { username: "Cy" }, author: "Ada" }).creator).toBe("Cy");
  });
});
