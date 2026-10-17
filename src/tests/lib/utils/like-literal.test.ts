import { describe, expect, it } from "@jest/globals";
import { likeLiteral } from "~/lib/utils/like-literal";

describe("likeLiteral", () => {
  it("escapes the LIKE wildcards and the escape character, and nothing else", () => {
    expect(likeLiteral("100%_off\\")).toBe("100\\%\\_off\\\\");
    expect(likeLiteral("Takatta Loa")).toBe("Takatta Loa");
  });
});
