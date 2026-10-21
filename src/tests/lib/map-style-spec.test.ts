import { getStyleForTheme, type MapTheme } from "~/lib/map-styles/registry";
import "~/lib/map-styles/standard.json";
import "~/lib/map-styles/dark.json";
import "~/lib/map-styles/paper.json";

describe("MapLibre Style Specification Validation", () => {
  const mockFonts = {
    regular: ["DejaVu Sans Regular"],
    bold: ["DejaVu Sans Bold"],
    sans: ["DejaVu Sans"],
  };
  const mockGlyphsUrl = "https://example.com/glyphs/{fontstack}/{range}.pbf";

  const themes: MapTheme[] = ["standard", "dark", "paper"];
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
        const symbolLayers = resolvedStyle.layers.filter((l: any) => l.type === "symbol");

        expect(symbolLayers.length).toBeGreaterThan(0);

        symbolLayers.forEach((layer: any) => {
          if (layer.layout && layer.layout["text-font"]) {
            const fonts = layer.layout["text-font"];
            // If it's a simple array (not an expression like "case"), it should match mock fonts
            const isExpression =
              Array.isArray(fonts) &&
              ["case", "match", "coalesce", "step", "interpolate"].includes(fonts[0]);
            if (Array.isArray(fonts) && typeof fonts[0] === "string" && !isExpression) {
              fonts.forEach((font: string) => {
                expect(mockFonts.regular.concat(mockFonts.bold).concat(mockFonts.sans)).toContain(
                  font
                );
              });
            }
          }
        });
      });
    });
  });
});
