import type { HeraldryComposition, LayoutResult, LayoutElement } from "./types";

export function computeLayout(comp: HeraldryComposition): LayoutResult {
  const charges: LayoutElement[] = [];

  // Default charge positions based on count
  const count = comp.shield.charges?.reduce((acc, c) => acc + c.count, 0) ?? 0;
  let chargeIdx = 0;

  // Normalized shield dimensions inside standard SVG viewport (1000x1000)
  const shield = { x: 250, y: 250, width: 500, height: 500 };

  if (comp.shield.charges && comp.shield.charges.length > 0) {
    comp.shield.charges.forEach((charge) => {
      const chargeSize = charge.size * 100; // base size (100px) scaled

      for (let i = 0; i < charge.count; i++) {
        let x = 0.5;
        let y = 0.55;

        // Position presets based on total count of all charges
        if (count === 1) {
          x = 0.5;
          y = 0.55;
        } else if (count === 2) {
          x = chargeIdx === 0 ? 0.33 : 0.67;
          y = 0.55;
        } else if (count === 3) {
          if (chargeIdx === 0) {
            x = 0.33;
            y = 0.4;
          } else if (chargeIdx === 1) {
            x = 0.67;
            y = 0.4;
          } else {
            x = 0.5;
            y = 0.7;
          }
        } else if (count === 4) {
          if (chargeIdx === 0) {
            x = 0.33;
            y = 0.4;
          } else if (chargeIdx === 1) {
            x = 0.67;
            y = 0.4;
          } else if (chargeIdx === 2) {
            x = 0.33;
            y = 0.7;
          } else {
            x = 0.67;
            y = 0.7;
          }
        } else {
          // Circle or grid layout for 5+
          const angle = (chargeIdx / count) * 2 * Math.PI;
          x = 0.5 + 0.2 * Math.cos(angle);
          y = 0.55 + 0.2 * Math.sin(angle);
        }

        // Map to viewport coordinates
        const viewportX = shield.x + x * shield.width;
        const viewportY = shield.y + y * shield.height;

        charges.push({
          id: `${charge.chargeId}-${chargeIdx}`,
          x: viewportX,
          y: viewportY,
          width: chargeSize,
          height: chargeSize,
          rotation: charge.mirrored ? 180 : 0,
        });

        chargeIdx++;
      }
    });
  }

  // Ordinaries are drawn direct by SVG renderer usually, so we map them full size
  const ordinaries = (comp.shield.ordinaries ?? []).map((ord, index) => ({
    id: `${ord.type}-${index}`,
    x: shield.x,
    y: shield.y,
    width: shield.width,
    height: shield.height,
    rotation: 0,
  }));

  // External elements coordinates
  const externals: LayoutResult["externals"] = {};

  if (comp.externals) {
    if (comp.externals.helm) {
      externals.helm = {
        id: "helm",
        x: 500,
        y: 200,
        width: 120,
        height: 150,
        rotation: 0,
      };
    }
    if (comp.externals.crest) {
      externals.crest = {
        id: "crest",
        x: 500,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
      };
    }
    if (comp.externals.mantling) {
      externals.mantling = {
        id: "mantling",
        x: 500,
        y: 220,
        width: 480,
        height: 380,
        rotation: 0,
      };
    }
    if (comp.externals.supporters) {
      externals.supporters = {
        dexter: {
          id: "supporter-dexter",
          x: 150,
          y: 500,
          width: 180,
          height: 350,
          rotation: 0,
        },
        sinister: {
          id: "supporter-sinister",
          x: 850,
          y: 500,
          width: 180,
          height: 350,
          rotation: 0,
        },
      };
    }
    if (comp.externals.motto) {
      externals.motto = {
        id: "motto",
        x: 500,
        y: 920,
        width: 600,
        height: 80,
        rotation: 0,
      };
    }
    if (comp.externals.compartment) {
      externals.compartment = {
        id: "compartment",
        x: 500,
        y: 840,
        width: 700,
        height: 100,
        rotation: 0,
      };
    }
  }

  return {
    shield,
    charges,
    ordinaries,
    externals,
  };
}
