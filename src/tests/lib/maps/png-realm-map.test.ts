import { MAX_PNG_BASE64_LENGTH, MAX_PNG_BYTES } from "~/lib/maps/png-realm-map";

describe("MAX_PNG_BASE64_LENGTH", () => {
  it("is the base64 length of the largest accepted PNG", () => {
    expect(Buffer.alloc(MAX_PNG_BYTES).toString("base64")).toHaveLength(MAX_PNG_BASE64_LENGTH);
  });
});
