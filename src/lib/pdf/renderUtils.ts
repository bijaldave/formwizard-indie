import { PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { CoordinateMap, InputBox } from './coordDetection';
import { ManualInputBox, GLOBAL_NUDGES } from './manualMaps';

/**
 * Draw text field with exact placement using manual coordinates
 */
export async function drawTextFieldManual(
  page: PDFPage,
  font: any,
  text: string,
  inputBox: ManualInputBox
): Promise<void> {
  if (!text || text.trim() === '') return;

  const x = inputBox.x + GLOBAL_NUDGES.textOffsetX;
  const y = inputBox.y + GLOBAL_NUDGES.textOffsetY;
  const width = inputBox.width;
  const height = inputBox.height;

  // Calculate optimal font size with better baseline handling
  let fontSize = Math.min(height * 0.7, 12);
  
  // Iteratively reduce font size until text fits
  while (fontSize > 6) {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    if (textWidth <= width * 0.9) {
      break;
    }
    fontSize -= 0.5;
  }

  // Better vertical centering with baseline consideration
  const fontHeight = font.heightAtSize(fontSize);
  const textY = y + (height - fontHeight) / 2 + fontHeight * 0.3; // Baseline adjustment

  page.drawText(text, {
    x: x + 2,
    y: textY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0)
  });
}

/**
 * Legacy function for backward compatibility
 */
export async function drawTextFieldExact(
  page: PDFPage,
  font: any,
  text: string,
  inputBox: InputBox,
  pageWidth: number,
  pageHeight: number
): Promise<void> {
  if (!text || text.trim() === '') return;

  // Convert normalized coordinates to absolute points
  const x = inputBox.xPct * pageWidth;
  const y = inputBox.yPct * pageHeight;
  const width = inputBox.wPct * pageWidth;
  const height = inputBox.hPct * pageHeight;

  // Calculate optimal font size to fit the text within the box
  let fontSize = 12;
  const maxFontSize = Math.min(height * 0.7, 14); // Cap at reasonable size
  
  // Iteratively reduce font size until text fits
  while (fontSize > 6) {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    if (textWidth <= width * 0.95) { // Leave 5% padding
      break;
    }
    fontSize -= 0.5;
  }

  fontSize = Math.min(fontSize, maxFontSize);

  // Center text vertically in the box
  const textY = y + (height - fontSize) / 2;

  page.drawText(text, {
    x: x + 2, // Small left padding
    y: textY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0)
  });
}

/**
 * Draw multi-line text field with manual coordinates
 */
export async function drawMultiLineTextManual(
  page: PDFPage,
  font: any,
  text: string,
  inputBox: ManualInputBox
): Promise<void> {
  if (!text || text.trim() === '') return;

  const x = inputBox.x + GLOBAL_NUDGES.textOffsetX;
  const y = inputBox.y + GLOBAL_NUDGES.textOffsetY;
  const width = inputBox.width;
  const height = inputBox.height;

  const fontSize = Math.min(height / 4, 10);
  const lineHeight = fontSize * 1.3;
  const maxLines = Math.floor(height / lineHeight);

  // Word wrap the text
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth <= width * 0.9 && lines.length < maxLines) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(word.substring(0, Math.floor(width / fontSize * 1.8)));
        currentLine = '';
      }
      
      if (lines.length >= maxLines) break;
    }
  }
  
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // Draw each line from top to bottom
  lines.forEach((line, index) => {
    const lineY = y + height - (fontSize + (index * lineHeight)) - 2;
    page.drawText(line, {
      x: x + 2,
      y: lineY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    });
  });
}

/**
 * Legacy function for backward compatibility
 */
export async function drawMultiLineTextExact(
  page: PDFPage,
  font: any,
  text: string,
  inputBox: InputBox,
  pageWidth: number,
  pageHeight: number
): Promise<void> {
  if (!text || text.trim() === '') return;

  // Convert normalized coordinates to absolute points
  const x = inputBox.xPct * pageWidth;
  const y = inputBox.yPct * pageHeight;
  const width = inputBox.wPct * pageWidth;
  const height = inputBox.hPct * pageHeight;

  const fontSize = 10;
  const lineHeight = fontSize * 1.2;
  const maxLines = Math.floor(height / lineHeight);

  // Word wrap the text
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth <= width * 0.95 && lines.length < maxLines) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Single word too long, truncate
        lines.push(word.substring(0, Math.floor(width / fontSize * 2)));
        currentLine = '';
      }
      
      if (lines.length >= maxLines) break;
    }
  }
  
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // Draw each line
  lines.forEach((line, index) => {
    const lineY = y + height - (fontSize + (index * lineHeight));
    page.drawText(line, {
      x: x + 2,
      y: lineY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    });
  });
}

/**
 * Draw checkbox with manual coordinates
 */
export async function drawCheckboxManual(
  page: PDFPage,
  checked: boolean,
  inputBox: ManualInputBox
): Promise<void> {
  if (!checked) return;

  const x = inputBox.x + GLOBAL_NUDGES.checkboxOffsetX;
  const y = inputBox.y + GLOBAL_NUDGES.checkboxOffsetY;
  const size = Math.min(inputBox.width, inputBox.height);

  // Draw a more visible checkmark
  const checkSize = size * 0.7;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  // Bold checkmark
  page.drawLine({
    start: { x: centerX - checkSize/3, y: centerY - checkSize/8 },
    end: { x: centerX - checkSize/8, y: centerY - checkSize/3 },
    thickness: 2.5,
    color: rgb(0, 0, 0)
  });

  page.drawLine({
    start: { x: centerX - checkSize/8, y: centerY - checkSize/3 },
    end: { x: centerX + checkSize/3, y: centerY + checkSize/5 },
    thickness: 2.5,
    color: rgb(0, 0, 0)
  });
}

/**
 * Legacy function for backward compatibility
 */
export async function drawCheckboxExact(
  page: PDFPage,
  checked: boolean,
  inputBox: InputBox,
  pageWidth: number,
  pageHeight: number
): Promise<void> {
  if (!checked) return;

  // Convert normalized coordinates to absolute points
  const x = inputBox.xPct * pageWidth;
  const y = inputBox.yPct * pageHeight;
  const size = Math.min(inputBox.wPct * pageWidth, inputBox.hPct * pageHeight);

  // Draw checkmark
  const checkSize = size * 0.8;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  // Simple checkmark using lines
  page.drawLine({
    start: { x: centerX - checkSize/3, y: centerY - checkSize/6 },
    end: { x: centerX - checkSize/6, y: centerY - checkSize/3 },
    thickness: 2,
    color: rgb(0, 0, 0)
  });

  page.drawLine({
    start: { x: centerX - checkSize/6, y: centerY - checkSize/3 },
    end: { x: centerX + checkSize/3, y: centerY + checkSize/4 },
    thickness: 2,
    color: rgb(0, 0, 0)
  });
}

/**
 * Draw signature image with manual coordinates
 */
export async function drawSignatureManual(
  page: PDFPage,
  signatureBase64: string,
  inputBox: ManualInputBox,
  pdfDoc: any
): Promise<void> {
  try {
    const x = inputBox.x + GLOBAL_NUDGES.signatureOffsetX;
    const y = inputBox.y + GLOBAL_NUDGES.signatureOffsetY;
    const width = inputBox.width;
    const height = inputBox.height;

    // Remove data URL prefix if present
    const base64Data = signatureBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Try to embed as PNG first, fallback to JPEG
    let image;
    try {
      image = await pdfDoc.embedPng(imageBytes);
    } catch {
      image = await pdfDoc.embedJpg(imageBytes);
    }

    // Scale image to fit within box while maintaining aspect ratio
    const imageAspectRatio = image.width / image.height;
    const boxAspectRatio = width / height;
    
    let finalWidth, finalHeight;
    if (imageAspectRatio > boxAspectRatio) {
      finalWidth = width * 0.95;
      finalHeight = finalWidth / imageAspectRatio;
    } else {
      finalHeight = height * 0.95;
      finalWidth = finalHeight * imageAspectRatio;
    }

    const finalX = x + (width - finalWidth) / 2;
    const finalY = y + (height - finalHeight) / 2;

    page.drawImage(image, {
      x: finalX,
      y: finalY,
      width: finalWidth,
      height: finalHeight
    });
  } catch (error) {
    console.error('Error drawing signature:', error);
    // Fallback: draw placeholder text
    await drawTextFieldManual(page, await pdfDoc.embedFont(StandardFonts.Helvetica), '[Signature]', inputBox);
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function drawSignatureExact(
  page: PDFPage,
  signatureBase64: string,
  inputBox: InputBox,
  pageWidth: number,
  pageHeight: number,
  pdfDoc: any
): Promise<void> {
  try {
    // Convert normalized coordinates to absolute points
    const x = inputBox.xPct * pageWidth;
    const y = inputBox.yPct * pageHeight;
    const width = inputBox.wPct * pageWidth;
    const height = inputBox.hPct * pageHeight;

    // Remove data URL prefix if present
    const base64Data = signatureBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Try to embed as PNG first, fallback to JPEG
    let image;
    try {
      image = await pdfDoc.embedPng(imageBytes);
    } catch {
      image = await pdfDoc.embedJpg(imageBytes);
    }

    // Scale image to fit within box while maintaining aspect ratio
    const imageAspectRatio = image.width / image.height;
    const boxAspectRatio = width / height;
    
    let finalWidth, finalHeight;
    if (imageAspectRatio > boxAspectRatio) {
      // Image is wider than box
      finalWidth = width * 0.96; // 2% padding
      finalHeight = finalWidth / imageAspectRatio;
    } else {
      // Image is taller than box
      finalHeight = height * 0.96; // 2% padding
      finalWidth = finalHeight * imageAspectRatio;
    }

    // Center the image in the box
    const finalX = x + (width - finalWidth) / 2;
    const finalY = y + (height - finalHeight) / 2;

    page.drawImage(image, {
      x: finalX,
      y: finalY,
      width: finalWidth,
      height: finalHeight
    });
  } catch (error) {
    console.error('Error drawing signature:', error);
    // Fallback: draw placeholder text
    await drawTextFieldExact(page, await pdfDoc.embedFont(StandardFonts.Helvetica), '[Signature]', inputBox, pageWidth, pageHeight);
  }
}