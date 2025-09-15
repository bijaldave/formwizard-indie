import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { Profile, DividendRow } from '../../types';
import { getManualCoordinateMap, ManualCoordinateMap } from './manualMaps';
import { drawTextFieldManual, drawMultiLineTextManual, drawCheckboxManual, drawSignatureManual } from './renderUtils';

/**
 * Format currency as ASCII-compatible "Rs. X,XXX.XX" format
 */
function formatCurrencyASCII(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Form 15H specific data interface
export interface Form15HData {
  name: string;
  pan: string;
  address: string;
  previous_year: string;
  assessment_year: string;
  residential_status: string;
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
 * Convert profile and dividend data to Form 15H format
 */
export function profileToForm15HData(profile: Profile, dividend: DividendRow): Form15HData {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const financialYear = profile.financialYear || `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  const assessmentYear = profile.assessmentYear || `${currentYear + 1}-${(currentYear + 2).toString().slice(-2)}`;
  const previousYear = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
  
  const addressParts = [
    profile.addr_flat,
    profile.addr_premises,
    profile.addr_street,
    profile.addr_area,
    profile.addr_city,
    profile.addr_state,
    profile.addr_pin
  ].filter(Boolean);
  
  // Use profile fields with proper fallbacks - estimated income should NOT come from dividend
  const estimatedIncomeTotal = profile.estimatedIncomeTotal || profile.income_total_fy || 0;
  const estimatedIncomeCurrent = profile.estimatedIncomeCurrent || dividend.total;
  const formCount = profile.formCount || profile.other_forms_count || 0;
  const formAmount = profile.formAmount || profile.other_forms_amount || 0;
  
  return {
    name: profile.name,
    pan: profile.pan,
    address: addressParts.join(', '),
    previous_year: previousYear,
    assessment_year: assessmentYear,
    residential_status: profile.residential_status === 'NRI' ? 'Non-Resident' : 'Resident',
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
 * Fill Form 15H PDF with manual coordinates
 */
export async function fillForm15H(
  templateFile: File,
  data: Form15HData,
  debugMode: boolean = false
): Promise<Uint8Array> {
  try {
    console.log('FILL15H: Starting PDF filling with manual coordinates');
    const arrayBuffer = await templateFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const page = pdfDoc.getPage(0);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    console.log('FILL15H: Using manual coordinate map');
    const manualMap = getManualCoordinateMap('15H');

    console.log('FILL15H: Filling all fields with manual coordinates');
    await fillAll15HFieldsManual(page, font, data, manualMap, pdfDoc);

    if (debugMode) {
      console.log('FILL15H: Rendering debug overlay');
      await renderDebugOverlayManual(page, font, manualMap);
    }

    console.log('FILL15H: Saving filled PDF');
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling Form 15H:', error);
    throw new Error(`Failed to fill Form 15H: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function fillAll15HFieldsManual(
  page: PDFPage,
  font: any,
  data: Form15HData,
  manualMap: ManualCoordinateMap,
  pdfDoc: PDFDocument
): Promise<void> {
  const textFieldMappings = [
    { field: 'name', value: data.name },
    { field: 'pan', value: data.pan },
    { field: 'previous_year', value: data.previous_year },
    { field: 'assessment_year', value: data.assessment_year },
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

  for (const mapping of textFieldMappings) {
    const inputBox = manualMap.fields[mapping.field];
    if (inputBox && mapping.value) {
      await drawTextFieldManual(page, font, mapping.value, inputBox);
    }
  }

  if (data.address && manualMap.fields.address) {
    await drawMultiLineTextManual(page, font, data.address, manualMap.fields.address);
  }

  const checkboxMappings = [
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

  if (data.signature && manualMap.fields.signature) {
    await drawSignatureManual(page, data.signature, manualMap.fields.signature, pdfDoc);
  }
}

async function renderDebugOverlayManual(page: PDFPage, font: any, manualMap: ManualCoordinateMap): Promise<void> {
  const { pageWidth, pageHeight } = manualMap;
  const gridSize = 25;
  const gridColor = rgb(0.9, 0.9, 0.9);

  // Draw grid
  for (let x = 0; x <= pageWidth; x += gridSize) {
    page.drawLine({ start: { x, y: 0 }, end: { x, y: pageHeight }, thickness: 0.3, color: gridColor });
  }

  for (let y = 0; y <= pageHeight; y += gridSize) {
    page.drawLine({ start: { x: 0, y }, end: { x: pageWidth, y }, thickness: 0.3, color: gridColor });
  }

  // Draw coordinate labels
  for (let x = 0; x <= pageWidth; x += gridSize * 4) {
    for (let y = 0; y <= pageHeight; y += gridSize * 4) {
      page.drawText(`${x.toFixed(0)},${y.toFixed(0)}`, {
        x: x + 2, y: y + 2, size: 6, font, color: rgb(0.5, 0.5, 0.5)
      });
    }
  }

  // Draw input boxes
  Object.entries(manualMap.fields).forEach(([fieldKey, inputBox]) => {
    page.drawRectangle({
      x: inputBox.x, y: inputBox.y, width: inputBox.width, height: inputBox.height,
      borderColor: rgb(0, 0, 1), borderWidth: 1.5, opacity: 0.4
    });
    page.drawText(fieldKey, {
      x: inputBox.x + 2, y: inputBox.y + inputBox.height + 4, size: 7, font, color: rgb(0, 0, 1)
    });
  });
}