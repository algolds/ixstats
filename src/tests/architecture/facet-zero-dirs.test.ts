/** @jest-environment node */
import fs from "fs";
import path from "path";
import { TELLS, isComment, walkTsx } from "./facet-tells";

const ROOT = path.resolve(__dirname, "../../..");
/** Converted directories stay at zero for every ratchet tell. Each app phase appends its own. */
const ZERO_TELL_DIRS = ["src/components/halo", "src/components/shell"];

describe.each(ZERO_TELL_DIRS)("%s has no AI-design tells", (dir) => {
  it.each(Object.keys(TELLS))("%s", (name) => {
    const hits = walkTsx(path.join(ROOT, dir)).flatMap((f) =>
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
