import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { Profile, DividendRow } from '../../types';
import { getManualCoordinateMap, ManualCoordinateMap } from './manualMaps';
import { drawTextFieldManual, drawCheckboxManual, drawSignatureManual } from './renderUtils';

/**
 * Format currency as ASCII-compatible "Rs. X,XXX.XX" format
 */
function formatCurrencyASCII(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  
  // Use profile fields with proper fallbacks - estimated income should NOT come from dividend
  const estimatedIncomeCurrent = profile.estimatedIncomeCurrent || profile.income_for_decl || dividend.total;
  const estimatedIncomeTotal = profile.estimatedIncomeTotal || profile.income_total_fy || 0;
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
    estimated_income_current: formatCurrencyASCII(estimatedIncomeCurrent),
    estimated_income_total: formatCurrencyASCII(estimatedIncomeTotal),
    boid: profile.boid,
    nature_income: 'Dividend',
    section: '194',
    dividend_amount: formatCurrencyASCII(dividend.total),
    form_count: formCount.toString(),
    form_amount: formatCurrencyASCII(formAmount),
    signature: profile.signature,
    place_date: `Mumbai, ${currentDate.toLocaleDateString('en-IN')}`,
    declaration_fy_end: profile.financialYearEnd || `31-03-${currentYear}`,
    declaration_ay: assessmentYear
  };
}

/**
 * Fill Form 15G PDF with provided data using manual coordinates
 */
export async function fillForm15G(
  templateFile: File,
  data: Form15GData,
  debugMode: boolean = false
): Promise<Uint8Array> {
  try {
    console.log('FILL15G: Starting PDF filling with manual coordinates');
    const arrayBuffer = await templateFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const page = pdfDoc.getPage(0);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    console.log('FILL15G: Using manual coordinate map');
    const manualMap = getManualCoordinateMap('15G');

    console.log('FILL15G: Filling all fields with manual coordinates');
    await fillAllFieldsManual(page, font, data, manualMap, pdfDoc);

    if (debugMode) {
      console.log('FILL15G: Rendering debug overlay');
      await renderDebugOverlayManual(page, font, manualMap);
    }

    console.log('FILL15G: Saving filled PDF');
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling Form 15G:', error);
    throw new Error(`Failed to fill Form 15G: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fill all fields using manual coordinates
 */
async function fillAllFieldsManual(
  page: PDFPage,
  font: any,
  data: Form15GData,
  manualMap: ManualCoordinateMap,
  pdfDoc: PDFDocument
): Promise<void> {
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
    const inputBox = manualMap.fields[mapping.field];
    if (inputBox && mapping.value) {
      await drawTextFieldManual(page, font, mapping.value, inputBox);
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
    const inputBox = manualMap.fields[mapping.field];
    if (inputBox && mapping.value) {
      await drawCheckboxManual(page, mapping.value, inputBox);
    }
  }

  // Fill signature
  if (data.signature && manualMap.fields.signature) {
    await drawSignatureManual(page, data.signature, manualMap.fields.signature, pdfDoc);
  }
}

/**
 * Render debug overlay for manual coordinate system
 */
async function renderDebugOverlayManual(
  page: PDFPage,
  font: any,
  manualMap: ManualCoordinateMap
): Promise<void> {
  const { pageWidth, pageHeight } = manualMap;
  const gridSize = 25;
  const gridColor = rgb(0.9, 0.9, 0.9);

  // Draw grid
  for (let x = 0; x <= pageWidth; x += gridSize) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: pageHeight },
      thickness: 0.3,
      color: gridColor
    });
  }

  for (let y = 0; y <= pageHeight; y += gridSize) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: pageWidth, y },
      thickness: 0.3,
      color: gridColor
    });
  }

  // Draw coordinate labels at major intersections
  for (let x = 0; x <= pageWidth; x += gridSize * 4) {
    for (let y = 0; y <= pageHeight; y += gridSize * 4) {
      page.drawText(`${x.toFixed(0)},${y.toFixed(0)}`, {
        x: x + 2,
        y: y + 2,
        size: 6,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
    }
  }

  // Draw input boxes (blue rectangles)
  Object.entries(manualMap.fields).forEach(([fieldKey, inputBox]) => {
    page.drawRectangle({
      x: inputBox.x,
      y: inputBox.y,
      width: inputBox.width,
      height: inputBox.height,
      borderColor: rgb(0, 0, 1),
      borderWidth: 1.5,
      opacity: 0.4
    });

    page.drawText(fieldKey, {
      x: inputBox.x + 2,
      y: inputBox.y + inputBox.height + 4,
      size: 7,
      font,
      color: rgb(0, 0, 1)
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