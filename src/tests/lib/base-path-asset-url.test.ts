/** @jest-environment node */
import { describe, it, expect, afterEach } from "@jest/globals";
import { assetUrl } from "~/lib/base-path";

describe("assetUrl", () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = original;
  });

  it("passes absolute, data: and blob: URLs through and drops empty values", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    expect(assetUrl("https://ixwiki.com/images/flag.png")).toBe(
      "https://ixwiki.com/images/flag.png"
    );
    expect(assetUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(assetUrl("blob:https://x/1")).toBe("blob:https://x/1");
    expect(assetUrl("  ")).toBeNull();
    expect(assetUrl(null)).toBeNull();
  });

  it("adds the base path to an uploaded flag's app-relative URL", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    expect(assetUrl("/images/uploads/uploaded_1_flag.png")).toBe(
      "/projects/ixstates/images/uploads/uploaded_1_flag.png"
    );
  });
});
