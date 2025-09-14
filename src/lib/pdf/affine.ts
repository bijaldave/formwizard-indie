export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AffineMatrix {
  a: number; b: number; c: number;  // x transformation: a*x + b*y + c
  d: number; e: number; f: number;  // y transformation: d*x + e*y + f
}

/**
 * Solve affine transformation matrix using least squares
 * Maps canonical points to measured points
 */
export function solveAffineTransform(
  canonicalPoints: Point[],
  measuredPoints: Point[]
): { matrix: AffineMatrix; rmsError: number } {
  if (canonicalPoints.length !== measuredPoints.length || canonicalPoints.length < 3) {
    throw new Error('Need at least 3 point pairs for affine transformation');
  }

  const n = canonicalPoints.length;
  
  // Set up matrices for least squares: A * x = B
  // For affine transform: [a b c; d e f] where [x'; y'] = [a b c; d e f] * [x; y; 1]
  
  // Matrix A: [n×3] for x-equation, [n×3] for y-equation -> [2n×6]
  const A: number[][] = [];
  const B: number[] = [];
  
  // Build system of equations
  for (let i = 0; i < n; i++) {
    const cp = canonicalPoints[i];
    const mp = measuredPoints[i];
    
    // x-equation: a*cp.x + b*cp.y + c = mp.x
    A.push([cp.x, cp.y, 1, 0, 0, 0]);
    B.push(mp.x);
    
    // y-equation: d*cp.x + e*cp.y + f = mp.y  
    A.push([0, 0, 0, cp.x, cp.y, 1]);
    B.push(mp.y);
  }
  
  // Solve using normal equation: (A^T * A)^-1 * A^T * B
  const AT = transpose(A);
  const ATA = multiplyMatrices(AT, A);
  const ATB = multiplyMatrixVector(AT, B);
  const ATAInv = invertMatrix6x6(ATA);
  const solution = multiplyMatrixVector(ATAInv, ATB);
  
  const matrix: AffineMatrix = {
    a: solution[0], b: solution[1], c: solution[2],
    d: solution[3], e: solution[4], f: solution[5]
  };
  
  // Calculate RMS error
  let totalError = 0;
  for (let i = 0; i < n; i++) {
    const transformed = applyAffine(matrix, canonicalPoints[i]);
    const dx = transformed.x - measuredPoints[i].x;
    const dy = transformed.y - measuredPoints[i].y;
    totalError += dx * dx + dy * dy;
  }
  const rmsError = Math.sqrt(totalError / n);
  
  return { matrix, rmsError };
}

/**
 * Apply affine transformation to a point
 */
export function applyAffine(matrix: AffineMatrix, point: Point): Point {
  return {
    x: matrix.a * point.x + matrix.b * point.y + matrix.c,
    y: matrix.d * point.x + matrix.e * point.y + matrix.f
  };
}

/**
 * Transform a rectangle using affine transformation
 * Transforms all 4 corners and computes bounding box
 */
export function transformRectangle(matrix: AffineMatrix, rect: Rectangle): Rectangle {
  // Get all 4 corners
  const corners = [
    { x: rect.x, y: rect.y },                           // bottom-left
    { x: rect.x + rect.width, y: rect.y },              // bottom-right
    { x: rect.x, y: rect.y + rect.height },             // top-left
    { x: rect.x + rect.width, y: rect.y + rect.height } // top-right
  ];
  
  // Transform all corners
  const transformedCorners = corners.map(corner => applyAffine(matrix, corner));
  
  // Find bounding box
  const xs = transformedCorners.map(p => p.x);
  const ys = transformedCorners.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Matrix utility functions
function transpose(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result: number[][] = [];
  
  for (let j = 0; j < cols; j++) {
    result[j] = [];
    for (let i = 0; i < rows; i++) {
      result[j][i] = matrix[i][j];
    }
  }
  
  return result;
}

function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const aRows = a.length;
  const aCols = a[0].length;
  const bCols = b[0].length;
  
  const result: number[][] = [];
  for (let i = 0; i < aRows; i++) {
    result[i] = [];
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  
  return result;
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map(row => 
    row.reduce((sum, val, i) => sum + val * vector[i], 0)
  );
}

function invertMatrix6x6(matrix: number[][]): number[][] {
  // For 6x6 matrix inversion, using Gauss-Jordan elimination
  const n = 6;
  const augmented: number[][] = [];
  
  // Create augmented matrix [A|I]
  for (let i = 0; i < n; i++) {
    augmented[i] = [...matrix[i]];
    for (let j = 0; j < n; j++) {
      augmented[i][n + j] = i === j ? 1 : 0;
    }
  }
  
  // Gauss-Jordan elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    
    // Make diagonal element 1
    const pivot = augmented[i][i];
    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= pivot;
    }
    
    // Eliminate column
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i];
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
  }
  
  // Extract inverse matrix
  const inverse: number[][] = [];
  for (let i = 0; i < n; i++) {
    inverse[i] = augmented[i].slice(n);
  }
  
  return inverse;
}