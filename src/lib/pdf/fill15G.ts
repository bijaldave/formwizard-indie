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
  assessment_year: string;
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
  estimated_income_current: string;
  estimated_income_total: string;
  boid: string;
  nature_income: string;
  section: string;
  dividend_amount: string;
  form_count: string;
  form_amount: string;
  signature?: string;
  place_date: string;
  declaration_fy_end: string;
  declaration_ay: string;
}

/**
 * Convert profile and dividend data to Form 15G format
 */
export function profileToForm15GData(profile: Profile, dividend: DividendRow): Form15GData {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const financialYear = profile.financialYear || `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  const assessmentYear = profile.assessmentYear || `${currentYear + 1}-${(currentYear + 2).toString().slice(-2)}`;
  const previousYear = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
  
  // Use updated field names with fallbacks for compatibility
  const estimatedIncomeCurrent = profile.estimatedIncomeCurrent || profile.income_for_decl || dividend.total;
  const estimatedIncomeTotal = profile.estimatedIncomeTotal || profile.income_total_fy || dividend.total;
  const formCount = profile.formCount || profile.other_forms_count || 0;
  const formAmount = profile.formAmount || profile.other_forms_amount || 0;
  
  return {
    name: profile.name,
    pan: profile.pan,
    status_individual: profile.status === 'Individual',
    status_huf: profile.status === 'HUF',
    previous_year: previousYear,
    assessment_year: assessmentYear,
    residential_status: profile.residential_status === 'NRI' ? 'Non-Resident' : 'Resident',
    addr_flat: profile.addr_flat,
    addr_premises: profile.addr_premises,
    addr_street: profile.addr_street,
    addr_area: profile.addr_area,
    addr_city: profile.addr_city,
    addr_state: profile.addr_state,
    addr_pin: profile.addr_pin,
    email: profile.email,
    phone: profile.phone,
    assessed_yes: profile.assessed_to_tax === 'Yes',
    assessed_no: profile.assessed_to_tax === 'No',
    latest_ay: profile.assessmentYearPrevious || profile.latest_ay || assessmentYear,
    estimated_income_current: dividend.total.toLocaleString('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 2 
    }),
    estimated_income_total: estimatedIncomeTotal.toLocaleString('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 2 
    }),
    boid: profile.boid,
    nature_income: 'Dividend',
    section: '194',
    dividend_amount: dividend.total.toLocaleString('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 2 
    }),
    form_count: formCount.toString(),
    form_amount: formAmount.toLocaleString('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 2 
    }),
    signature: profile.signature,
    place_date: `Mumbai, ${currentDate.toLocaleDateString('en-IN')}`,
    declaration_fy_end: profile.financialYearEnd || `31-03-${currentYear}`,
    declaration_ay: assessmentYear
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
    { field: 'previous_year', value: data.previous_year },
    { field: 'assessment_year', value: data.assessment_year },
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
    { field: 'estimated_income_current', value: data.estimated_income_current },
    { field: 'estimated_income_total', value: data.estimated_income_total },
    { field: 'boid', value: data.boid },
    { field: 'nature_income', value: data.nature_income },
    { field: 'section', value: data.section },
    { field: 'dividend_amount', value: data.dividend_amount },
    { field: 'form_count', value: data.form_count },
    { field: 'form_amount', value: data.form_amount },
    { field: 'declaration_fy_end', value: data.declaration_fy_end },
    { field: 'declaration_ay', value: data.declaration_ay }
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
    { field: 'status_individual', value: data.status_individual },
    { field: 'status_huf', value: data.status_huf },
    { field: 'residential_status', value: data.residential_status === 'Resident' },
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