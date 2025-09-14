import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { Profile, DividendRow } from '../../types';
import { detectAnchors } from './anchors';
import { solveAffineTransform, transformRectangle, AffineMatrix } from './affine';
import { CANONICAL_ANCHORS, FORM_15G_FIELDS, percentageToPoints, formatIndianNumber } from './fieldMaps';
import { templateManager } from './templateManager';
import { renderDebugOverlay } from './debug';
import { CoordinateMap, validateAnchors } from './coordDetection';

export interface Form15GData {
  name: string;
  pan: string;
  status_individual: boolean;
  status_huf: boolean;
  previous_year: string;
  residential_status: string;
  addr_flat: string;
  addr_premises: string;
  addr_street: string;
  addr_area: string;
  addr_city: string;
  addr_state: string;
  addr_pin: string;
  email: string;
  phone: string;
  assessed_yes: boolean;
  assessed_no: boolean;
  latest_ay: string;
  income_for_decl: string;
  income_total_fy: string;
  other_forms_count: string;
  other_forms_amount: string;
  boid: string;
  nature_income: string;
  section: string;
  dividend_amount: string;
  signature?: string; // base64 image
  place_date: string;
}

/**
 * Convert profile and dividend data to Form 15G format
 */
export function profileToForm15GData(profile: Profile, readyDividends: DividendRow[]): Form15GData {
  const totalDividend = readyDividends.reduce((sum, d) => sum + d.total, 0);
  const currentDate = new Date();
  
  return {
    name: profile.name,
    pan: profile.pan,
    status_individual: profile.status === 'Individual',
    status_huf: profile.status === 'HUF',
    previous_year: `${currentDate.getFullYear() - 1}-${currentDate.getFullYear().toString().slice(-2)}`,
    residential_status: profile.residential_status || 'Indian',
    addr_flat: profile.addr_flat || '',
    addr_premises: profile.addr_premises || '',
    addr_street: profile.addr_street || '',
    addr_area: profile.addr_area || '',
    addr_city: profile.addr_city || '',
    addr_state: profile.addr_state || '',
    addr_pin: profile.addr_pin || '',
    email: profile.email || '',
    phone: profile.phone || '',
    assessed_yes: profile.assessed_to_tax === 'Yes',
    assessed_no: profile.assessed_to_tax === 'No',
    latest_ay: profile.latest_ay || `${currentDate.getFullYear()}-${(currentDate.getFullYear() + 1).toString().slice(-2)}`,
    income_for_decl: formatIndianNumber(totalDividend),
    income_total_fy: formatIndianNumber(profile.income_total_fy || totalDividend),
    other_forms_count: profile.other_forms_count?.toString() || '0',
    other_forms_amount: formatIndianNumber(profile.other_forms_amount || 0),
    boid: profile.boid || '',
    nature_income: 'Dividend',
    section: '194',
    dividend_amount: formatIndianNumber(totalDividend),
    signature: profile.signature,
    place_date: `${profile.addr_city || 'Place'}, ${currentDate.toLocaleDateString('en-IN')}`
  };
}

/**
 * Fill Form 15G PDF with provided data using enhanced coordinate detection
 */
export async function fillForm15G(
  templateFile: File,
  data: Form15GData,
  debugMode: boolean = false
): Promise<Uint8Array> {
  try {
    // Load the PDF
    const arrayBuffer = await templateFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const page = pdfDoc.getPage(0);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Get coordinate map using enhanced detection
    const coordinateMap = await templateManager.getCoordinateMap(templateFile, '15G');
    
    // Validate anchors before filling
    const validation = await validateAnchors(templateFile, coordinateMap, '15G');
    if (!validation.valid) {
      console.warn('Form 15G validation issues:', validation.errors);
      // Continue with detected coordinates but log warnings
    }

    // Fill all fields using exact coordinate placement
    await fillAllFieldsExact(page, font, data, coordinateMap, pdfDoc);

    // Add debug overlay if requested
    if (debugMode) {
      await renderDebugOverlayExact(page, font, coordinateMap);
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling Form 15G:', error);
    throw new Error(`Failed to fill Form 15G: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fill all fields using enhanced coordinate detection
 */
async function fillAllFieldsExact(
  page: PDFPage,
  font: any,
  data: Form15GData,
  coordinateMap: CoordinateMap,
  pdfDoc: PDFDocument
): Promise<void> {
  const { drawTextFieldExact, drawMultiLineTextExact, drawCheckboxExact, drawSignatureExact } = await import('./renderUtils');
  
  // Text fields mapping
  const textFieldMappings = [
    { field: 'name', value: data.name },
    { field: 'pan', value: data.pan },
    { field: 'addr_flat', value: data.addr_flat },
    { field: 'addr_premises', value: data.addr_premises },
    { field: 'addr_street', value: data.addr_street },
    { field: 'addr_area', value: data.addr_area },
    { field: 'addr_city', value: data.addr_city },
    { field: 'addr_state', value: data.addr_state },
    { field: 'addr_pin', value: data.addr_pin },
    { field: 'email', value: data.email },
    { field: 'phone', value: data.phone },
    { field: 'latest_ay', value: data.latest_ay },
    { field: 'income_for_decl', value: data.income_for_decl },
    { field: 'boid', value: data.boid },
    { field: 'nature_income', value: data.nature_income },
    { field: 'section', value: data.section },
    { field: 'dividend_amount', value: data.dividend_amount }
  ];

  // Fill text fields
  for (const mapping of textFieldMappings) {
    const inputBox = coordinateMap.fields[mapping.field];
    if (inputBox && mapping.value) {
      await drawTextFieldExact(
        page, 
        font, 
        mapping.value, 
        inputBox, 
        coordinateMap.pageWidth, 
        coordinateMap.pageHeight
      );
    }
  }

  // Fill checkboxes
  const checkboxMappings = [
    { field: 'assessed_yes', value: data.assessed_yes },
    { field: 'assessed_no', value: data.assessed_no }
  ];

  for (const mapping of checkboxMappings) {
    const inputBox = coordinateMap.fields[mapping.field];
    if (inputBox && mapping.value) {
      await drawCheckboxExact(
        page,
        mapping.value,
        inputBox,
        coordinateMap.pageWidth,
        coordinateMap.pageHeight
      );
    }
  }

  // Fill signature
  if (data.signature && coordinateMap.fields.signature) {
    await drawSignatureExact(
      page,
      data.signature,
      coordinateMap.fields.signature,
      coordinateMap.pageWidth,
      coordinateMap.pageHeight,
      pdfDoc
    );
  }
}

/**
 * Render debug overlay for exact coordinate system
 */
async function renderDebugOverlayExact(
  page: PDFPage,
  font: any,
  coordinateMap: CoordinateMap
): Promise<void> {
  const pageWidth = coordinateMap.pageWidth;
  const pageHeight = coordinateMap.pageHeight;

  // Draw 20x20 grid
  const gridSize = 20;
  const gridColor = rgb(0.9, 0.9, 0.9);

  for (let x = 0; x <= pageWidth; x += gridSize) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: pageHeight },
      thickness: 0.5,
      color: gridColor
    });
  }

  for (let y = 0; y <= pageHeight; y += gridSize) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: pageWidth, y },
      thickness: 0.5,
      color: gridColor
    });
  }

  // Draw anchors (green dots)
  Object.entries(coordinateMap.anchors).forEach(([fieldKey, anchor]) => {
    page.drawCircle({
      x: anchor.x,
      y: anchor.y,
      size: 4,
      color: rgb(0, 1, 0),
      opacity: 0.7
    });

    page.drawText(`${fieldKey}`, {
      x: anchor.x + 6,
      y: anchor.y + 6,
      size: 8,
      font,
      color: rgb(0, 1, 0)
    });
  });

  // Draw input boxes (red rectangles)
  Object.entries(coordinateMap.fields).forEach(([fieldKey, inputBox]) => {
    const x = inputBox.xPct * pageWidth;
    const y = inputBox.yPct * pageHeight;
    const width = inputBox.wPct * pageWidth;
    const height = inputBox.hPct * pageHeight;

    page.drawRectangle({
      x, y, width, height,
      borderColor: rgb(1, 0, 0),
      borderWidth: 1,
      opacity: 0.3
    });

    page.drawText(fieldKey, {
      x: x + 2,
      y: y + height + 2,
      size: 6,
      font,
      color: rgb(1, 0, 0)
    });
  });
}

/**
 * Legacy function maintained for backward compatibility
 */
async function drawTextField(page: PDFPage, font: any, text: string, rect: any): Promise<void> {
  if (!text || text.trim() === '') return;

  let fontSize = 12;
  const maxWidth = rect.width * 0.9;

  while (fontSize > 6) {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    if (textWidth <= maxWidth) break;
    fontSize -= 0.5;
  }

  const textY = rect.y + (rect.height - fontSize) / 2;

  page.drawText(text, {
    x: rect.x + 5,
    y: textY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0)
  });
}

/**
 * Legacy function maintained for backward compatibility
 */
async function drawCheckbox(page: PDFPage, rect: any): Promise<void> {
  const size = Math.min(rect.width, rect.height) * 0.8;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  page.drawLine({
    start: { x: centerX - size/3, y: centerY - size/6 },
    end: { x: centerX - size/6, y: centerY - size/3 },
    thickness: 2,
    color: rgb(0, 0, 0)
  });

  page.drawLine({
    start: { x: centerX - size/6, y: centerY - size/3 },
    end: { x: centerX + size/3, y: centerY + size/4 },
    thickness: 2,
    color: rgb(0, 0, 0)
  });
}