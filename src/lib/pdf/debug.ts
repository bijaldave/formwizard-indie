import { PDFPage, rgb } from 'pdf-lib';
import { AffineMatrix, Point } from './affine';
import { FORM_15G_FIELDS, percentageToPoints } from './fieldMaps';
import { transformRectangle } from './affine';

/**
 * Render debug overlay on PDF page
 */
export async function renderDebugOverlay(
  page: PDFPage,
  font: any,
  affineMatrix: AffineMatrix,
  detectedAnchors: Point[],
  canonicalAnchors: Point[]
): Promise<void> {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // Draw 20x20 grid
  drawGrid(page, pageWidth, pageHeight);

  // Draw anchor points
  drawAnchorPoints(page, font, detectedAnchors, canonicalAnchors, affineMatrix);

  // Draw field boundaries
  drawFieldBoundaries(page, affineMatrix);

  // Draw transform info
  drawTransformInfo(page, font, affineMatrix, detectedAnchors, canonicalAnchors);
}

/**
 * Draw light grid overlay
 */
function drawGrid(page: PDFPage, width: number, height: number): void {
  const gridSize = 20;
  const gridColor = rgb(0.9, 0.9, 0.9);
  const strokeWidth = 0.5;

  // Vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: height },
      thickness: strokeWidth,
      color: gridColor
    });
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: strokeWidth,
      color: gridColor
    });
  }
}

/**
 * Draw anchor points with labels
 */
function drawAnchorPoints(
  page: PDFPage,
  font: any,
  detectedAnchors: Point[],
  canonicalAnchors: Point[],
  affineMatrix: AffineMatrix
): void {
  const radius = 4;

  // Draw detected anchors (blue circles)
  detectedAnchors.forEach((anchor, index) => {
    page.drawCircle({
      x: anchor.x,
      y: anchor.y,
      size: radius,
      color: rgb(0, 0, 1), // Blue
      opacity: 0.7
    });

    // Label
    page.drawText(`D${index + 1}`, {
      x: anchor.x + radius + 2,
      y: anchor.y + radius + 2,
      size: 8,
      font,
      color: rgb(0, 0, 1)
    });
  });

  // Draw canonical anchors (green circles)
  canonicalAnchors.forEach((anchor, index) => {
    page.drawCircle({
      x: anchor.x,
      y: anchor.y,
      size: radius,
      color: rgb(0, 1, 0), // Green
      opacity: 0.7
    });

    // Label
    page.drawText(`C${index + 1}`, {
      x: anchor.x + radius + 2,
      y: anchor.y - radius - 10,
      size: 8,
      font,
      color: rgb(0, 1, 0)
    });
  });

  // Draw lines connecting corresponding anchors
  for (let i = 0; i < Math.min(detectedAnchors.length, canonicalAnchors.length); i++) {
    page.drawLine({
      start: canonicalAnchors[i],
      end: detectedAnchors[i],
      thickness: 1,
      color: rgb(1, 0, 1), // Magenta
      opacity: 0.5
    });
  }
}

/**
 * Draw field boundaries
 */
function drawFieldBoundaries(page: PDFPage, affineMatrix: AffineMatrix): void {
  Object.entries(FORM_15G_FIELDS).forEach(([fieldName, field]) => {
    const canonicalRect = percentageToPoints(field);
    const transformedRect = transformRectangle(affineMatrix, canonicalRect);

    // Draw red rectangle around field
    page.drawRectangle({
      x: transformedRect.x,
      y: transformedRect.y,
      width: transformedRect.width,
      height: transformedRect.height,
      borderColor: rgb(1, 0, 0), // Red
      borderWidth: 1,
      opacity: 0.3
    });
  });
}

/**
 * Draw transformation information
 */
function drawTransformInfo(
  page: PDFPage,
  font: any,
  affineMatrix: AffineMatrix,
  detectedAnchors: Point[],
  canonicalAnchors: Point[]
): void {
  // Calculate RMS error
  let totalError = 0;
  const minLength = Math.min(detectedAnchors.length, canonicalAnchors.length);
  
  for (let i = 0; i < minLength; i++) {
    const dx = detectedAnchors[i].x - canonicalAnchors[i].x;
    const dy = detectedAnchors[i].y - canonicalAnchors[i].y;
    totalError += dx * dx + dy * dy;
  }
  
  const rmsError = Math.sqrt(totalError / minLength);

  // Calculate scale factors
  const scaleX = Math.sqrt(affineMatrix.a * affineMatrix.a + affineMatrix.d * affineMatrix.d);
  const scaleY = Math.sqrt(affineMatrix.b * affineMatrix.b + affineMatrix.e * affineMatrix.e);
  
  // Calculate rotation angle
  const rotation = Math.atan2(affineMatrix.d, affineMatrix.a) * 180 / Math.PI;

  // Draw info box in top-right corner
  const infoX = page.getWidth() - 200;
  const infoY = page.getHeight() - 20;
  const lineHeight = 12;

  // Background
  page.drawRectangle({
    x: infoX - 5,
    y: infoY - 80,
    width: 190,
    height: 75,
    color: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    opacity: 0.9
  });

  // Info text
  const infoLines = [
    `RMS Error: ${rmsError.toFixed(2)}pt`,
    `Scale X: ${scaleX.toFixed(3)}`,
    `Scale Y: ${scaleY.toFixed(3)}`,
    `Rotation: ${rotation.toFixed(1)}°`,
    `Anchors: ${detectedAnchors.length}/${canonicalAnchors.length}`,
    `Matrix: [${affineMatrix.a.toFixed(3)}, ${affineMatrix.b.toFixed(3)}, ${affineMatrix.c.toFixed(1)}]`,
    `       [${affineMatrix.d.toFixed(3)}, ${affineMatrix.e.toFixed(3)}, ${affineMatrix.f.toFixed(1)}]`
  ];

  infoLines.forEach((line, index) => {
    page.drawText(line, {
      x: infoX,
      y: infoY - (index * lineHeight),
      size: 9,
      font,
      color: rgb(0, 0, 0)
    });
  });
}