export const ShapeType = {
  Square: "square",
  HST: "hst",
  QST: "qst",
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
  repeatWidth: number;
  repeatHeight: number;
}

export interface Palette {
  name: string;
  colors: string[];
}
