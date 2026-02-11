export const ShapeType = {
  Square: "square",
  HST: "hst",
  QST: "qst",
  // HST with one half split into 2 quarter triangles (3 pieces total)
  // colors: [solidHalf, splitA, splitB]
  // rotation determines which half is solid:
  //   0 = bottom-left solid, top-right split
  //   90 = top-left solid, bottom-right split
  //   180 = top-right solid, bottom-left split
  //   270 = bottom-right solid, top-left split
  HSTSplit: "hst-split",
} as const;

export type ShapeType = (typeof ShapeType)[keyof typeof ShapeType];

export const SymmetryMode = {
  None: "none",
  Horizontal: "horizontal",
  Vertical: "vertical",
  FourWay: "four-way",
  DiagonalTLBR: "diagonal-tlbr",
  DiagonalTRBL: "diagonal-trbl",
  Rotational: "rotational",
} as const;

export type SymmetryMode = (typeof SymmetryMode)[keyof typeof SymmetryMode];

export interface QuiltBlock {
  shape: ShapeType;
  colors: string[];
  rotation: number; // 0, 90, 180, 270
}

export interface BorderConfig {
  lineCount: number;       // 0-5
  colors: string[];        // color/placeholder for each line (indexes into current palette)
  widthFraction: number;   // width per line as fraction of block size: 0.25, 0.5, 0.75, 1
  cornerstoneColor?: string; // color for sashing intersections (sashing only)
}

export interface AppState {
  gridWidth: number;
  gridHeight: number;
  seed: number;
  symmetry: number; // 0-100
  symmetryMode: SymmetryMode;
  enabledShapes: Record<ShapeType, boolean>;
  shapeRatios: Record<ShapeType, number>;
  paletteIndex: number;
  customPalettes: Palette[];
  paletteColorCount: number;
  colorCountMode: "max" | "exact";  // max = up to N colors, exact = use exactly N colors
  repeatWidth: number;
  repeatHeight: number;
  outerBorder: BorderConfig;
  sashingBorder: BorderConfig;  // between repeat blocks
  scaleEnabled: boolean;        // whether scale/dimensions feature is active
  blockSizeInches: number;      // finished block size in inches (e.g. 9.5)
  blockSizeCustom: boolean;     // true if user entered a custom block size
  useMetric: boolean;           // show metric (cm) instead of inches
  quiltSize: string;            // selected quilt size key (e.g. "queen") or "" for none
}

// A swatch can be a solid color (string) or a fabric image
export interface FabricSwatch {
  type: "fabric";
  dataUrl: string;    // Cropped/resampled image as data URL
  sourceUrl?: string; // Original image for re-editing
}

export type Swatch = string | FabricSwatch;

export function isColorSwatch(s: Swatch): s is string {
  return typeof s === "string";
}

export function isFabricSwatch(s: Swatch): s is FabricSwatch {
  return typeof s === "object" && s.type === "fabric";
}

export interface Palette {
  name: string;
  colors: string[];       // Legacy: solid colors
  swatches?: Swatch[];    // New: can be colors or fabrics
}
