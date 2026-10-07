/**
 * Characterization test for parseSvgToGeoJson (plan 315).
 *
 * Pins the full parse result (features, FeatureCollection, layers, viewBox and
 * the diagnostic log) for fixed SVG fixtures covering layer matching, the
 * single-layer fallbacks, reference-GeoJSON calibration/geometry reuse, ring
 * orientation handling and the per-path skip/error paths.
 */
import { describe, expect, it } from "@jest/globals";
import { createHash } from "crypto";
import type { FeatureCollection } from "geojson";
import { parseSvgToGeoJson, type SvgParseConfig } from "~/lib/flags/svg-parser";

const NS =
  'xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"';

const POLITICAL_SVG = `<svg ${NS} viewBox="0 0 360 180" width="360" height="180">
  <g id="background" inkscape:label="Background"><path id="bg" d="M0 0 H360 V180 H0 Z"/></g>
  <g id="political-layer" inkscape:label="Political">
    <path id="New_Harren" style="fill:#ff0000;stroke:#000000" d="M10 10 L50 10 L50 40 L10 40 Z"/>
    <path id="curvy" inkscape:label="Curvy Land" fill="#00ff00" d="M100 50 C120 30 140 30 160 50 Q170 70 160 90 L100 90 Z"/>
    <path id="holed" d="M200 20 L260 20 L260 80 L200 80 Z M215 35 L215 65 L245 65 L245 35 Z"/>
    <path id="holed_reversed" d="M200 100 L200 160 L260 160 L260 100 Z M215 115 L245 115 L245 145 L215 145 Z"/>
    <path id="archipelago" data-name="Archi Pelago" d="M20 100 L40 100 L40 120 L20 120 Z M60 100 L80 100 L80 120 L60 120 Z"/>
    <path id="reversed_pair" d="M100 120 L100 140 L120 140 L120 120 Z M130 120 L130 140 L150 140 L150 120 Z"/>
    <path id="relative_arc" d="m300 20 h20 v20 a10 10 0 0 1 -20 0 z"/>
    <path id="tiny" d="M300 100 L301 100"/>
    <path id="empty"/>
    <path id="broken" d="M10 10 X 20"/>
    <path id="offmap" d="M-500 -500 L-400 -500 L-400 -400 Z"/>
    <g id="nested"><path d="M300 150 L340 150 L340 170 Z"/></g>
  </g>
</svg>`;

const REFERENCE: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "New_Harren" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-170, 80],
            [-130, 80],
            [-130, 50],
            [-170, 50],
            [-170, 80],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "holed",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [20, 70],
              [80, 70],
              [80, 10],
              [20, 10],
              [20, 70],
            ],
          ],
          [
            [
              [30, 60],
              [35, 60],
              [35, 55],
              [30, 60],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { id: "curvy" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-80, 40],
            [-20, 40],
            [-20, 0],
            [-80, 0],
            [-80, 40],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { id: "empty_coords" },
      geometry: { type: "Polygon", coordinates: [] },
    },
    { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } },
  ],
};

const ONE_MATCH_REFERENCE: FeatureCollection = {
  type: "FeatureCollection",
  features: [REFERENCE.features[0]!],
};

const CASES: Record<string, { svg: string; layerType: string; config?: SvgParseConfig }> = {
  politicalByLabel: { svg: POLITICAL_SVG, layerType: "political" },
  backgroundById: { svg: POLITICAL_SVG, layerType: "back-ground" },
  calibratedWithReference: {
    svg: POLITICAL_SVG,
    layerType: "political",
    config: { referenceGeoJson: REFERENCE },
  },
  calibrationFallsBack: {
    svg: POLITICAL_SVG,
    layerType: "political",
    config: { referenceGeoJson: ONE_MATCH_REFERENCE, bezierSegments: 3, minRingSize: 5 },
  },
  soleGroupFallback: {
    svg: `<svg ${NS} viewBox="0 0 100 50"><g id="only"><path id="a" d="M10 10 L30 10 L30 30 Z"/></g><g id="nopaths"/></svg>`,
    layerType: "rivers",
  },
  nestedLabelFallback: {
    svg: `<svg ${NS} viewBox="0,0,200,100"><g id="g1"><g id="sub" inkscape:label="Lakes"><path id="lake" d="M10 10 L60 10 L60 50 Z"/></g></g><g id="g2"><path id="x" d="M100 10 L150 10 L150 50 Z"/><path id="y" d="M100 60 L150 60 L150 90 Z"/></g></svg>`,
    layerType: "lakes",
  },
  largestGroupFallback: {
    svg: `<svg ${NS} viewBox="0 0 200 100"><g id="g1"><path id="p1" d="M10 10 L60 10 L60 50 Z"/></g><g id="g2"><path id="p2" d="M100 10 L150 10 L150 50 Z"/><path id="p3" d="M100 60 L150 60 L150 90 Z"/></g></svg>`,
    layerType: "climate",
  },
  rootPathsFallback: {
    svg: `<svg ${NS} viewBox="0 0 10 10"><path id="p" d="M1 1 L5 1 L5 5 L1 5 Z"/></svg>`,
    layerType: "icecaps",
  },
  noViewBoxDefaults: {
    svg: `<svg ${NS}><g id="political"><path id="p" d="M100 100 C200 50 300 50 400 100 L400 300 L100 300 Z"/></g></svg>`,
    layerType: "political",
  },
  shortViewBox: {
    svg: `<svg ${NS} viewBox="0 0 100"><g id="political"><path id="p" d="M10 10 L50 10 L50 40 Z"/></g></svg>`,
    layerType: "political",
  },
  zeroViewBox: {
    svg: `<svg ${NS} viewBox="0 0 0 0"><g id="political"><path id="p" d="M10 10 L50 10 L50 40 Z"/></g></svg>`,
    layerType: "political",
  },
  noPathsThrows: {
    svg: `<svg ${NS} viewBox="0 0 10 10"><g id="a"/><g id="b"/></svg>`,
    layerType: "political",
  },
};

type Summary = {
  log: string[];
  layersFound: string[];
  viewBox: { width: number; height: number };
  geometryTypes: string[];
};
type Outcome = { error: string } | { summary: Summary; digest: string };

// Re-pinned 2026-10-07 when rings became classified by containment and wound per RFC 7946 (outer
// counter-clockwise, holes clockwise) with holes subtracted from the area; same rings, logs and properties.
const EXPECTED: Record<string, Outcome> = {
  politicalByLabel: {
    summary: {
      log: [
        "Parsing SVG for layer type: political",
        "SVG viewBox: 360 × 180",
        "Mapping viewBox (360×180) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: background, political-layer",
        "Extracting features from layer: political-layer",
        "  Skipping tiny: no valid rings",
        "  Skipping empty: no path data",
        '  Error processing broken: Expected ",", ".", [ \\t\\n\\r], [+\\-], [0-9], [Aa], [Cc], [Hh], [Ll], [Mm], [Qq], [Ss], [Tt], [Vv], [Zz], or end of input but "X" found.',
        "  Skipping offmap: all coordinates outside valid range",
        "Extracted 8 features from 12 paths",
      ],
      layersFound: ["background", "political-layer"],
      viewBox: { width: 360, height: 180 },
      geometryTypes: [
        "New_Harren:Polygon",
        "curvy:Polygon",
        "holed:Polygon",
        "holed_reversed:Polygon",
        "archipelago:MultiPolygon",
        "reversed_pair:MultiPolygon",
        "relative_arc:Polygon",
        "feature_11:Polygon",
      ],
    },
    digest: "f54892267def84b9f2476f94c8f51184c67fea3a22b90333fa9c4c738580006f",
  },
  backgroundById: {
    summary: {
      log: [
        "Parsing SVG for layer type: back-ground",
        "SVG viewBox: 360 × 180",
        "Mapping viewBox (360×180) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: background, political-layer",
        "Extracting features from layer: background",
        "  Skipping bg: all coordinates outside valid range",
        "Extracted 0 features from 1 paths",
      ],
      layersFound: ["background", "political-layer"],
      viewBox: { width: 360, height: 180 },
      geometryTypes: [],
    },
    digest: "8bcc2532f2c63777517dbe0057bacc27d86edc0ab53d8a7332760c12d8a462f3",
  },
  calibratedWithReference: {
    summary: {
      log: [
        "Parsing SVG for layer type: political",
        "SVG viewBox: 360 × 180",
        "Calibrated from 3 matched features (scale: 1.000000 deg/px)",
        "Layers found in SVG: background, political-layer",
        "Extracting features from layer: political-layer",
        "Reference geometry available for 3 features",
        "  Skipping tiny: no valid rings",
        "  Skipping empty: no path data",
        '  Error processing broken: Expected ",", ".", [ \\t\\n\\r], [+\\-], [0-9], [Aa], [Cc], [Hh], [Ll], [Mm], [Qq], [Ss], [Tt], [Vv], [Zz], or end of input but "X" found.',
        "  Skipping offmap: all coordinates outside valid range",
        "Extracted 8 features from 12 paths",
        "Used reference geometry for 3 features (5 from SVG conversion)",
      ],
      layersFound: ["background", "political-layer"],
      viewBox: { width: 360, height: 180 },
      geometryTypes: [
        "New_Harren:Polygon",
        "curvy:Polygon",
        "holed:MultiPolygon",
        "holed_reversed:Polygon",
        "archipelago:MultiPolygon",
        "reversed_pair:MultiPolygon",
        "relative_arc:Polygon",
        "feature_11:Polygon",
      ],
    },
    digest: "10fef1c3a782a576feb2d2a07c2529cc1ea9df958a88a10ea8aa450ae8c1799c",
  },
  calibrationFallsBack: {
    summary: {
      log: [
        "Parsing SVG for layer type: political",
        "SVG viewBox: 360 × 180",
        "Calibration failed (1 matches found, need 2+). Falling back to bounds mapping.",
        "Mapping viewBox (360×180) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: background, political-layer",
        "Extracting features from layer: political-layer",
        "Reference geometry available for 1 features",
        "  Skipping tiny: no valid rings",
        "  Skipping empty: no path data",
        '  Error processing broken: Expected ",", ".", [ \\t\\n\\r], [+\\-], [0-9], [Aa], [Cc], [Hh], [Ll], [Mm], [Qq], [Ss], [Tt], [Vv], [Zz], or end of input but "X" found.',
        "  Skipping offmap: all coordinates outside valid range",
        "  Skipping feature_11: all rings too small",
        "Extracted 7 features from 12 paths",
        "Used reference geometry for 1 features (6 from SVG conversion)",
      ],
      layersFound: ["background", "political-layer"],
      viewBox: { width: 360, height: 180 },
      geometryTypes: [
        "New_Harren:Polygon",
        "curvy:Polygon",
        "holed:Polygon",
        "holed_reversed:Polygon",
        "archipelago:MultiPolygon",
        "reversed_pair:MultiPolygon",
        "relative_arc:Polygon",
      ],
    },
    digest: "0b13ea3e2a3bc2275607fa74ec07655b2b38742d4ffeabca4769f840a0ce4b03",
  },
  soleGroupFallback: {
    summary: {
      log: [
        "Parsing SVG for layer type: rivers",
        "SVG viewBox: 100 × 50",
        "Mapping viewBox (100×50) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: only, nopaths",
        'Layer "rivers" not found by name; using sole group "only" (1 paths)',
        "Extracting features from layer: only",
        "Extracted 1 features from 1 paths",
      ],
      layersFound: ["only", "nopaths"],
      viewBox: { width: 100, height: 50 },
      geometryTypes: ["a:Polygon"],
    },
    digest: "316c1eb846b069ca2f4633ff0970db91a6680443ebb9233aa2728e28f9ea201b",
  },
  nestedLabelFallback: {
    summary: {
      log: [
        "Parsing SVG for layer type: lakes",
        "SVG viewBox: 200 × 100",
        "Mapping viewBox (200×100) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: g1, g2",
        'Found nested layer "sub" inside group "g1"',
        "Extracting features from layer: sub",
        "Extracted 1 features from 1 paths",
      ],
      layersFound: ["g1", "g2"],
      viewBox: { width: 200, height: 100 },
      geometryTypes: ["lake:Polygon"],
    },
    digest: "b91b895388e3cbf58709560ba9c711ce3cca7a3e0f550964b59a573b16ec2825",
  },
  largestGroupFallback: {
    summary: {
      log: [
        "Parsing SVG for layer type: climate",
        "SVG viewBox: 200 × 100",
        "Mapping viewBox (200×100) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: g1, g2",
        'Layer "climate" not found by name; using largest group "g2" (2 paths)',
        "Extracting features from layer: g2",
        "Extracted 2 features from 2 paths",
      ],
      layersFound: ["g1", "g2"],
      viewBox: { width: 200, height: 100 },
      geometryTypes: ["p2:Polygon", "p3:Polygon"],
    },
    digest: "e534eb6b1d0f43f67bf83c915de5ff034163e4dbac112bce6a06d7884f2fb64c",
  },
  rootPathsFallback: {
    summary: {
      log: [
        "Parsing SVG for layer type: icecaps",
        "SVG viewBox: 10 × 10",
        "Mapping viewBox (10×10) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: ",
        'Layer "icecaps" not found by name; using SVG root (1 total paths)',
        "Extracting features from layer: null",
        "Extracted 1 features from 1 paths",
      ],
      layersFound: [],
      viewBox: { width: 10, height: 10 },
      geometryTypes: ["p:Polygon"],
    },
    digest: "b478db1dfdfdb65f21e70bb18a434c1955a51adfc15faa381b4f5252261126cd",
  },
  noViewBoxDefaults: {
    summary: {
      log: [
        "Parsing SVG for layer type: political",
        "Mapping viewBox (25625×15729) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: political",
        "Extracting features from layer: political",
        "Extracted 1 features from 1 paths",
      ],
      layersFound: ["political"],
      viewBox: { width: 25625, height: 15729 },
      geometryTypes: ["p:Polygon"],
    },
    digest: "441955fedda30d5ba75a4c8ab330767528b4dafaa6b9fb490861221c213a0b0f",
  },
  shortViewBox: {
    summary: {
      log: [
        "Parsing SVG for layer type: political",
        "Mapping viewBox (25625×15729) to WGS84 bounds (lat range: ±90.0°)",
        "Layers found in SVG: political",
        "Extracting features from layer: political",
        "Extracted 1 features from 1 paths",
      ],
      layersFound: ["political"],
      viewBox: { width: 25625, height: 15729 },
      geometryTypes: ["p:Polygon"],
    },
    digest: "0685f34d8a328c1f9a1902e4f8ad56bfdf92c735cb73d87b4f9398dcc659dcff",
  },
  zeroViewBox: {
    summary: {
      log: [
        "Parsing SVG for layer type: political",
        "SVG viewBox: 0 × 0",
        "Layers found in SVG: political",
        "Extracting features from layer: political",
        "  Skipping p: all coordinates outside valid range",
        "Extracted 0 features from 1 paths",
      ],
      layersFound: ["political"],
      viewBox: { width: 0, height: 0 },
      geometryTypes: [],
    },
    digest: "ce4cc9785819a0c9ac35c88c6abc6af59e990241a6ffb6c7f1b2fb32265a5032",
  },
  noPathsThrows: { error: 'Layer "political" not found in SVG. Available layers: a, b' },
};

function characterize(name: string): Outcome {
  const { svg, layerType, config } = CASES[name]!;
  try {
    const result = parseSvgToGeoJson(svg, layerType, config);
    return {
      summary: {
        log: result.log,
        layersFound: result.layersFound,
        viewBox: result.viewBox,
        geometryTypes: result.features.map((f) => `${f.featureId}:${f.geometry.type}`),
      },
      digest: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

describe("parseSvgToGeoJson characterization (fixed fixtures)", () => {
  for (const name of Object.keys(CASES)) {
    it(`${name} is byte-identical to the pinned result`, () => {
      const actual = characterize(name);
      if (process.env.CHARACTERIZE === "1") {
        console.log(`CHAR ${name} ${JSON.stringify(actual)}`);
        return;
      }
      expect(actual).toEqual(EXPECTED[name]);
    });
  }
});
