import { type AppState, ShapeType, SymmetryMode } from "./types";

type Listener = () => void;

const MAX_HISTORY = 20;

export class Store {
  private state: AppState;
  private listeners: Listener[] = [];
  private _seedHistory: number[] = [];

  constructor(initial: AppState) {
    this.state = { ...initial };
    this._seedHistory = [initial.seed];
  }

  get(): AppState {
    return this.state;
  }

  get seedHistory(): readonly number[] {
    return this._seedHistory;
  }

  update(partial: Partial<AppState>): void {
    if (partial.seed !== undefined && partial.seed !== this.state.seed) {
      // Push old seed to history (avoid duplicates at the front)
      if (this._seedHistory[0] !== this.state.seed) {
        this._seedHistory.unshift(this.state.seed);
      }
      if (this._seedHistory.length > MAX_HISTORY) {
        this._seedHistory.length = MAX_HISTORY;
      }
    }
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function defaultState(): AppState {
  return {
    gridWidth: 8,
    gridHeight: 8,
    seed: Date.now(),
    symmetry: 100,
    symmetryMode: SymmetryMode.FourWay,
    enabledShapes: {
      [ShapeType.Square]: true,
      [ShapeType.HST]: true,
      [ShapeType.QST]: true,
      [ShapeType.HSTSplit]: false, // Only created by simplification, not directly selectable
    },
    shapeRatios: {
      [ShapeType.Square]: 33,
      [ShapeType.HST]: 34,
      [ShapeType.QST]: 33,
      [ShapeType.HSTSplit]: 0,
    },
    paletteIndex: 0,
    customPalettes: [],
    paletteColorCount: 6,
    repeatWidth: 4,
    repeatHeight: 4,
    outerBorder: { lineCount: 0, colors: [], widthFraction: 1 },
    sashingBorder: { lineCount: 0, colors: [], widthFraction: 1 },
  };
}
