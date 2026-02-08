import { type QuiltBlock, ShapeType } from "./types";

// Normalize color for comparison (case-insensitive)
function colorEq(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

/**
 * Simplify blocks where adjacent triangles of the same color can be merged:
 * - HST with both colors the same → Square
 * - QST with 2+ adjacent triangles same color → HST or Square
 */
export function simplifyBlock(block: QuiltBlock): QuiltBlock {
  if (block.shape === ShapeType.HST) {
    // If both triangles are the same color, it's just a square
    if (colorEq(block.colors[0], block.colors[1])) {
      return {
        shape: ShapeType.Square,
        colors: [block.colors[0]],
        rotation: 0,
      };
    }
  }

  if (block.shape === ShapeType.QST) {
    const [top, right, bottom, left] = block.colors;
    
    // All 4 same → Square
    if (colorEq(top, right) && colorEq(right, bottom) && colorEq(bottom, left)) {
      return {
        shape: ShapeType.Square,
        colors: [top],
        rotation: 0,
      };
    }

    // Check for pairs of adjacent triangles that match
    // QST layout: top(0), right(1), bottom(2), left(3)
    // Adjacent pairs forming diagonals:
    // - top+right vs bottom+left (\ diagonal)
    // - top+left vs right+bottom (/ diagonal)

    // Top + Right same AND Bottom + Left same → HST with \ diagonal
    if (colorEq(top, right) && colorEq(bottom, left)) {
      return {
        shape: ShapeType.HST,
        colors: [bottom, top], // bottom-left color, top-right color
        rotation: 0,
      };
    }

    // Top + Left same AND Right + Bottom same → HST with / diagonal
    if (colorEq(top, left) && colorEq(right, bottom)) {
      return {
        shape: ShapeType.HST,
        colors: [left, right], // top-left color, bottom-right color
        rotation: 90,
      };
    }

    // Three same (one different) - becomes an HST
    // Top + Right + Bottom same, Left different
    if (colorEq(top, right) && colorEq(right, bottom) && !colorEq(bottom, left)) {
      return {
        shape: ShapeType.HST,
        colors: [left, top],
        rotation: 270,
      };
    }
    // Right + Bottom + Left same, Top different
    if (colorEq(right, bottom) && colorEq(bottom, left) && !colorEq(left, top)) {
      return {
        shape: ShapeType.HST,
        colors: [top, right],
        rotation: 0,
      };
    }
    // Bottom + Left + Top same, Right different
    if (colorEq(bottom, left) && colorEq(left, top) && !colorEq(top, right)) {
      return {
        shape: ShapeType.HST,
        colors: [right, bottom],
        rotation: 90,
      };
    }
    // Left + Top + Right same, Bottom different
    if (colorEq(left, top) && colorEq(top, right) && !colorEq(right, bottom)) {
      return {
        shape: ShapeType.HST,
        colors: [bottom, top],
        rotation: 180,
      };
    }

    // Single adjacent pair same (other two different) → HSTSplit
    // This is 3 pieces: 1 HST-sized triangle + 2 QST-sized triangles
    
    // Bottom + Left same (bottom-left corner solid)
    if (colorEq(bottom, left) && !colorEq(top, right)) {
      return {
        shape: ShapeType.HSTSplit,
        colors: [bottom, top, right], // solid half, then the two split pieces
        rotation: 0,
      };
    }
    
    // Top + Left same (top-left corner solid)
    if (colorEq(top, left) && !colorEq(right, bottom)) {
      return {
        shape: ShapeType.HSTSplit,
        colors: [top, right, bottom],
        rotation: 90,
      };
    }
    
    // Top + Right same (top-right corner solid)
    if (colorEq(top, right) && !colorEq(bottom, left)) {
      return {
        shape: ShapeType.HSTSplit,
        colors: [top, bottom, left],
        rotation: 180,
      };
    }
    
    // Right + Bottom same (bottom-right corner solid)
    if (colorEq(right, bottom) && !colorEq(left, top)) {
      return {
        shape: ShapeType.HSTSplit,
        colors: [right, left, top],
        rotation: 270,
      };
    }
  }

  return block;
}

/**
 * Simplify all blocks in a grid
 */
export function simplifyGrid(grid: QuiltBlock[][]): QuiltBlock[][] {
  return grid.map(row => row.map(block => simplifyBlock(block)));
}
