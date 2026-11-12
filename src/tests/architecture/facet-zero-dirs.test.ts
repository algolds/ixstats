/** @jest-environment node */
import fs from "fs";
import path from "path";
import { TELLS, isComment, walkTsx } from "./facet-tells";

const ROOT = path.resolve(__dirname, "../../..");
/** Converted directories stay at zero for every ratchet tell. Each app phase appends its own. */
const ZERO_TELL_DIRS = [
  "src/components/halo",
  "src/components/shell",
  "src/components/exchange",
  "src/app/_components/front-page",
  "src/app/mycountry",
  "src/components/executive",
  "src/components/mycountry",
  "src/components/vault/daily-reward",
];

/** Brand wordmarks explicitly exempted from raw-palette / registered-trademark checks. */
const EXEMPT = new Set(["src/components/mycountry/shared/primitives/mycountry-logo.tsx"]);

describe.each(ZERO_TELL_DIRS)("%s has no AI-design tells", (dir) => {
  it.each(Object.keys(TELLS))("%s", (name) => {
    const hits = walkTsx(path.join(ROOT, dir))
      .filter((f) => !EXEMPT.has(path.relative(ROOT, f)))
      .flatMap((f) =>
        fs
          .readFileSync(f, "utf8")
          .split("\n")
          .flatMap((l, i) =>
            !isComment(l) && (l.match(TELLS[name]!)?.length ?? 0) > 0
              ? [`${path.relative(ROOT, f)}:${i + 1}`]
              : []
          )
      );
    expect(hits).toEqual([]);
  });
});
