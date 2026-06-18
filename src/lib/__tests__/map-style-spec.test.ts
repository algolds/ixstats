import { getStyleForTheme, type MapTheme } from "../map-styles/registry";
import standardStyle from "../map-styles/standard.json";
import darkStyle from "../map-styles/dark.json";
import paperStyle from "../map-styles/paper.json";

describe("MapLibre Style Specification Validation", () => {
  const mockFonts = {
    regular: ["DejaVu Sans Regular"],
    bold: ["DejaVu Sans Bold"],
    sans: ["DejaVu Sans"],
  };
  const mockGlyphsUrl = "https://example.com/glyphs/{fontstack}/{range}.pbf";

  const themes: MapTheme[] = ["standard", "dark", "paper"];

  test("should import JSON templates correctly", () => {
    expect(standardStyle).toBeDefined();
    expect(darkStyle).toBeDefined();
    expect(paperStyle).toBeDefined();
  });

  themes.forEach((theme) => {
    describe(`${theme} theme style validation`, () => {
      let resolvedStyle: any;

      beforeEach(() => {
        resolvedStyle = getStyleForTheme(theme, mockGlyphsUrl, mockFonts);
      });

      test("should conform to base MapLibre Style Spec requirements", () => {
        expect(resolvedStyle.version).toBe(8);
        expect(resolvedStyle.glyphs).toBe(mockGlyphsUrl);
        expect(typeof resolvedStyle.sources).toBe("object");
        expect(Array.isArray(resolvedStyle.layers)).toBe(true);
      });

      test("should have valid layers referencing defined sources", () => {
        const sourceKeys = Object.keys(resolvedStyle.sources);

        resolvedStyle.layers.forEach((layer: any) => {
          expect(layer.id).toBeDefined();
          expect(typeof layer.id).toBe("string");
          expect(layer.type).toBeDefined();

          if (layer.source) {
            // Layer must reference a source defined in the sources block
            expect(sourceKeys).toContain(layer.source);
          }
        });
      });

      test("should fully resolve all font placeholders", () => {
        const checkFontsRecursively = (obj: any) => {
          if (Array.isArray(obj)) {
            obj.forEach((item) => {
              expect(item).not.toBe("__FONT_REGULAR__");
              expect(item).not.toBe("__FONT_BOLD__");
              expect(item).not.toBe("__FONT_SANS__");
              checkFontsRecursively(item);
            });
          } else if (obj !== null && typeof obj === "object") {
            Object.values(obj).forEach((val) => checkFontsRecursively(val));
          }
        };

        checkFontsRecursively(resolvedStyle.layers);
      });

      test("should resolve font stacks to font strings", () => {
        // Find a symbol layer and verify its font stack is resolved
        const symbolLayers = resolvedStyle.layers.filter(
          (l: any) => l.type === "symbol"
        );

        expect(symbolLayers.length).toBeGreaterThan(0);

        symbolLayers.forEach((layer: any) => {
          if (layer.layout && layer.layout["text-font"]) {
            const fonts = layer.layout["text-font"];
            // If it's a simple array (not an expression like "case"), it should match mock fonts
            const isExpression = Array.isArray(fonts) && ["case", "match", "coalesce", "step", "interpolate"].includes(fonts[0]);
            if (Array.isArray(fonts) && typeof fonts[0] === "string" && !isExpression) {
              fonts.forEach((font: string) => {
                expect(
                  mockFonts.regular.concat(mockFonts.bold).concat(mockFonts.sans)
                ).toContain(font);
              });
            }
          }
        });
      });
    });
  });

  test("themes should have distinct styling choices", () => {
    const standard = getStyleForTheme("standard", mockGlyphsUrl, mockFonts);
    const dark = getStyleForTheme("dark", mockGlyphsUrl, mockFonts);
    const paper = getStyleForTheme("paper", mockGlyphsUrl, mockFonts);

    // Verify background color is different
    const getBgColor = (style: any) => {
      const bg = style.layers.find((l: any) => l.type === "background");
      return bg?.paint?.["background-color"];
    };

    expect(getBgColor(standard)).toBe("#b3cde0");
    expect(getBgColor(dark)).toBe("#0f172a");
    expect(getBgColor(paper)).toBe("#f2ecda");

    // Verify political fill opacity or colors differ
    const getPolFillOpacity = (style: any) => {
      const pol = style.layers.find((l: any) => l.id === "fill-political");
      return pol?.paint?.["fill-opacity"];
    };

    expect(getPolFillOpacity(standard)).toBe(0.4);
    expect(getPolFillOpacity(dark)).toBe(0.25);
    expect(getPolFillOpacity(paper)).toBe(0.2);
  });
});
