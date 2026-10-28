import { nextTheme } from "~/context/theme-context";

describe("nextTheme", () => {
  it("cycles light, dark, system", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
    expect(nextTheme("system")).toBe("light");
  });
});
