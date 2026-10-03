import { z } from "zod/v4";

const tinctureSchema = z.enum([
  "or",
  "argent",
  "gules",
  "azure",
  "vert",
  "purpure",
  "sable",
  "ermine",
  "vair",
  "counter-ermine",
  "counter-vair",
  "erminois",
  "pean",
  "tenne",
  "sanguine",
  "murrey",
]);

const divisionSchema = z.enum([
  "plain",
  "per-pale",
  "per-fess",
  "per-bend",
  "per-bend-sinister",
  "quarterly",
  "gyronny",
  "per-saltire",
  "per-chevron",
  "tierced-in-pale",
  "tierced-in-fess",
  "barry",
  "paly",
  "bendy",
  "checky",
  "lozengy",
  "chevronny",
]);

const lineStyleSchema = z.enum([
  "straight",
  "engrailed",
  "invected",
  "wavy",
  "nebuly",
  "indented",
  "dancetty",
  "embattled",
  "dovetailed",
  "potenty",
  "raguly",
  "urdy",
]);

const ordinaryTypeSchema = z.enum([
  "chief",
  "fess",
  "pale",
  "bend",
  "bend-sinister",
  "chevron",
  "saltire",
  "cross",
  "bordure",
  "canton",
  "pile",
  "orle",
  "tressure",
  "pall",
  "gyron",
  "lozenge-ordinary",
]);

const shieldShapeSchema = z.enum([
  "heater",
  "kite",
  "round",
  "lozenge",
  "oval",
  "renaissance",
  "pointed",
]);

const attitudeSchema = z.enum([
  "rampant",
  "passant",
  "sejant",
  "couchant",
  "dormant",
  "salient",
  "statant",
  "guardant",
  "reguardant",
  "displayed",
  "rising",
  "volant",
  "naiant",
  "hauriant",
]);

const helmTypeSchema = z.enum(["great-helm", "tilting-helm", "barrel-helm", "open-faced-helm"]);

const helmFacingSchema = z.enum(["affronte", "dexter", "sinister"]);

const mottoPositionSchema = z.enum(["above", "below"]);

const chargeRefSchema = z.object({
  chargeId: z.string().uuid().or(z.string().min(1)),
  position: z.string().min(1),
  count: z.number().int().min(1).max(50),
  tincture: tinctureSchema,
  secondaryTincture: tinctureSchema.optional(),
  tertiaryTincture: tinctureSchema.optional(),
  size: z.number().min(0.1).max(5.0),
  attitude: attitudeSchema.optional(),
  mirrored: z.boolean().optional(),
});

const ordinaryConfigSchema = z.object({
  type: ordinaryTypeSchema,
  tincture: tinctureSchema,
  lineStyle: lineStyleSchema,
});

const fieldConfigSchema = z.object({
  division: divisionSchema,
  tinctures: z.array(tinctureSchema).min(1),
  lineStyle: lineStyleSchema,
});

const shieldConfigSchema = z.object({
  shape: shieldShapeSchema,
  field: fieldConfigSchema,
  ordinaries: z.array(ordinaryConfigSchema).default([]),
  charges: z.array(chargeRefSchema).default([]),
});

const helmConfigSchema = z.object({
  type: helmTypeSchema,
  facing: helmFacingSchema,
});

const crestConfigSchema = z.object({
  chargeId: z.string().min(1),
  wreathTinctures: z.tuple([tinctureSchema, tinctureSchema]),
});

const mantlingConfigSchema = z.object({
  exteriorTincture: tinctureSchema,
  interiorTincture: tinctureSchema,
});

const supporterConfigSchema = z.object({
  chargeId: z.string().min(1),
  attitude: attitudeSchema.optional(),
  tincture: tinctureSchema.optional(),
});

const mottoConfigSchema = z.object({
  text: z.string().min(1).max(200),
  position: mottoPositionSchema.default("below"),
});

const externalOrnamentsSchema = z.object({
  helm: helmConfigSchema.optional(),
  crest: crestConfigSchema.optional(),
  mantling: mantlingConfigSchema.optional(),
  supporters: z
    .object({
      dexter: supporterConfigSchema,
      sinister: supporterConfigSchema,
    })
    .optional(),
  compartment: z.string().optional(),
  motto: mottoConfigSchema.optional(),
});

export const compositionSchema = z.object({
  shield: shieldConfigSchema,
  externals: externalOrnamentsSchema.optional(),
});
