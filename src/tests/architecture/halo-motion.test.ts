import fs from "fs";
import path from "path";

const src = path.resolve(__dirname, "../..");
const walk = (d: string): string[] =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(d, e.name))
        : e.name.endsWith(".tsx")
          ? [path.join(d, e.name)]
          : []
    );
const isComment = (l: string) => /^\s*(\/\/|\*|\/\*|\{\s*\/\*)/.test(l);

const STILL: Record<string, RegExp> = {
  ping: /\banimate-ping\b/,
  pulse: /\banimate-pulse\b/,
  loop: /repeat:\s*Infinity/,
  // Also the named-group forms (`group-hover/tick:scale-125`), which a bare `hover:` match misses.
  hoverMotion: /hover(?:\/[\w-]+)?:(?:scale|rotate|translate)-/,
  pressScale: /active:scale-/,
  numericDuration: /\bduration-\d+\b/,
  arbitraryEase: /\bease-\[/,
  inlineSeconds: /\bduration:\s*\d*\.\d+/,
  glowAnimation: /animate-(?:flash-notification|di-critical|di-nav-pulse)/,
  shoutedCopy: /"(?:FULL TIME|LIVE)"/,
};

it.each(Object.keys(STILL))("Halo has no %s", (name) => {
  const hits = walk(path.join(src, "components/halo")).flatMap((f) =>
    fs
      .readFileSync(f, "utf8")
      .split("\n")
      .flatMap((l, i) =>
        !isComment(l) && STILL[name]!.test(l) ? [`${path.relative(src, f)}:${i + 1}`] : []
      )
  );
  expect(hits).toEqual([]);
});

it("the Halo glow keyframes are gone", () => {
  const css = ["styles/animations.css", "styles/wiki-os/layout.css"]
    .map((p) => fs.readFileSync(path.join(src, p), "utf8"))
    .join("\n");
  expect(css).not.toMatch(/flash-notification|di-critical|di-nav-pulse/);
});
