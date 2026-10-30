/** @jest-environment node */
/**
 * The MyCountry section router lives once, in the `(command)` route-group layout, so it stays mounted
 * across sidebar clicks (the `<Activity>` keep-alive and the cross-fade only work then). A section page
 * that rendered the router itself would mount a second one beside the layout's.
 */
import fs from "fs";
import path from "path";

const commandDir = path.resolve(__dirname, "../../app/mycountry/(command)");

const SECTION_ROUTES = [
  "defense",
  "diplomacy",
  "economy",
  "executive",
  "intelligence",
  "politics",
  "",
].sort();

function listPages(dir: string, base = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return listPages(path.join(dir, entry.name), path.posix.join(base, entry.name));
    return entry.name === "page.tsx" ? [base] : [];
  });
}

describe("MyCountry (command) layout", () => {
  it("renders the router in the layout, once", () => {
    const layout = fs.readFileSync(path.join(commandDir, "layout.tsx"), "utf-8");
    expect(layout.match(/<MyCountryRouter\s*\/>/g)).toHaveLength(1);
  });

  it("has no section page that renders or imports MyCountryRouter", () => {
    const offenders = listPages(commandDir).filter((route) =>
      fs.readFileSync(path.join(commandDir, route, "page.tsx"), "utf-8").includes("MyCountryRouter")
    );
    expect(offenders).toEqual([]);
  });

  it("holds exactly the seven section routes", () => {
    expect(listPages(commandDir).sort()).toEqual(SECTION_ROUTES);
  });
});
