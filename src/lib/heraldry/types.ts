// --- Heraldic primitives ---

export type TinctureMetal = "or" | "argent";
export type TinctureColour = "gules" | "azure" | "vert" | "purpure" | "sable";
export type TinctureFur =
  "ermine" | "vair" | "counter-ermine" | "counter-vair" | "erminois" | "pean";
export type TinctureStain = "tenne" | "sanguine" | "murrey";
export type Tincture = TinctureMetal | TinctureColour | TinctureFur | TinctureStain;

export type TinctureKind = "metal" | "colour" | "fur" | "stain";

export type Division =
  | "plain"
  | "per-pale"
  | "per-fess"
  | "per-bend"
  | "per-bend-sinister"
  | "quarterly"
  | "gyronny"
  | "per-saltire"
  | "per-chevron"
  | "tierced-in-pale"
  | "tierced-in-fess"
  | "barry"
  | "paly"
  | "bendy"
  | "checky"
  | "lozengy"
  | "chevronny";

export type LineStyle =
  | "straight"
  | "engrailed"
  | "invected"
  | "wavy"
  | "nebuly"
  | "indented"
  | "dancetty"
  | "embattled"
  | "dovetailed"
  | "potenty"
  | "raguly"
  | "urdy";

export type OrdinaryType =
  | "chief"
  | "fess"
  | "pale"
  | "bend"
  | "bend-sinister"
  | "chevron"
  | "saltire"
  | "cross"
  | "bordure"
  | "canton"
  | "pile"
  | "orle"
  | "tressure"
  | "pall"
  | "gyron"
  | "lozenge-ordinary";

export type ShieldShape =
  "heater" | "kite" | "round" | "lozenge" | "oval" | "renaissance" | "pointed";

export type Attitude =
  | "rampant"
  | "passant"
  | "sejant"
  | "couchant"
  | "dormant"
  | "salient"
  | "statant"
  | "guardant"
  | "reguardant"
  | "displayed"
  | "rising"
  | "volant"
  | "naiant"
  | "hauriant";

export type HelmType = "great-helm" | "tilting-helm" | "barrel-helm" | "open-faced-helm";
export type HelmFacing = "affronte" | "dexter" | "sinister";
export type MottoPosition = "above" | "below";

// --- Composition structures ---

export interface ChargeRef {
  chargeId: string;
  position: string; // "fess-point", "chief-point", "on-ordinary:0", etc.
  count: number;
  tincture: Tincture;
  secondaryTincture?: Tincture;
  tertiaryTincture?: Tincture;
  size: number; // 0.1 to 2.0, relative to shield
  attitude?: Attitude;
  mirrored?: boolean;
}

export interface OrdinaryConfig {
  type: OrdinaryType;
  tincture: Tincture;
  lineStyle: LineStyle;
}

export interface FieldConfig {
  division: Division;
  tinctures: Tincture[]; // one per division section
  lineStyle: LineStyle;
}

export interface ShieldConfig {
  shape: ShieldShape;
  field: FieldConfig;
  ordinaries: OrdinaryConfig[];
  charges: ChargeRef[];
}

export interface HelmConfig {
  type: HelmType;
  facing: HelmFacing;
}

export interface CrestConfig {
  chargeId: string;
  wreathTinctures: [Tincture, Tincture];
}

export interface MantlingConfig {
  exteriorTincture: Tincture;
  interiorTincture: Tincture;
}

export interface SupporterConfig {
  chargeId: string;
  attitude?: Attitude;
  tincture?: Tincture;
}

export interface MottoConfig {
  text: string;
  position: MottoPosition;
}

export interface ExternalOrnaments {
  helm?: HelmConfig;
  crest?: CrestConfig;
  mantling?: MantlingConfig;
  supporters?: {
    dexter: SupporterConfig;
    sinister: SupporterConfig;
  };
  compartment?: string; // chargeId for the base element
  motto?: MottoConfig;
}

export interface HeraldryComposition {
  shield: ShieldConfig;
  externals?: ExternalOrnaments;
}

// --- Validation ---

export type ValidationSeverity = "info" | "advisory" | "caution";

export interface ValidationWarning {
  code: string;
  severity: ValidationSeverity;
  message: string;
  elementPath?: string; // e.g. "shield.charges[0]"
}
