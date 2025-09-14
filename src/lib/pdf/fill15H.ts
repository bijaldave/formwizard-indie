import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { Profile, DividendRow } from '../../types';
import { templateManager } from './templateManager';
import { validateAnchors, CoordinateMap } from './coordDetection';

// Form 15H specific data interface
export interface Form15HData {
  name: string;
  pan: string;
  address: string;
  assessed_yes: boolean;
  assessed_no: boolean;
  latest_ay: string;
  income_amount: string;
  nature_income: string;
  section: string;
  signature?: string;
  place_date: string;
}

/**
 * Convert profile and dividend data to Form 15H format
 */
export function profileToForm15HData(profile: Profile, dividend: DividendRow): Form15HData {
  const currentDate = new Date();
  
  const addressParts = [
    profile.addr_flat,
    profile.addr_premises,
    profile.addr_street,
    profile.addr_area,
    profile.addr_city,
    profile.addr_state,
    profile.addr_pin
  ].filter(Boolean);
  
  return {
    name: profile.name,
    pan: profile.pan,
    address: addressParts.join(', '),
    assessed_yes: profile.assessed_to_tax === 'Yes',
    assessed_no: profile.assessed_to_tax === 'No',
    latest_ay: profile.latest_ay || `${currentDate.getFullYear()}-${(currentDate.getFullYear() + 1).toString().slice(-2)}`,
    income_amount: dividend.total.toLocaleString('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 2 
    }),
    nature_income: 'Dividend',
    section: '194',
    signature: profile.signature,
    place_date: `${profile.addr_city || 'Place'}, ${currentDate.toLocaleDateString('en-IN')}`
  };
}

/**
 * Fill Form 15H PDF with enhanced coordinate detection
 */
export async function fillForm15H(
  templateFile: File,
  data: Form15HData,
  debugMode: boolean = false
): Promise<Uint8Array> {
  try {
    const arrayBuffer = await templateFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const page = pdfDoc.getPage(0);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const coordinateMap = await templateManager.getCoordinateMap(templateFile, '15H');
    
    const validation = await validateAnchors(templateFile, coordinateMap, '15H');
    if (!validation.valid) {
      console.warn('Form 15H validation issues:', validation.errors);
    }

    await fillAll15HFieldsExact(page, font, data, coordinateMap, pdfDoc);

    if (debugMode) {
      await renderDebugOverlayExact(page, font, coordinateMap);
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling Form 15H:', error);
    throw new Error(`Failed to fill Form 15H: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function fillAll15HFieldsExact(
  page: PDFPage,
  font: any,
  data: Form15HData,
  coordinateMap: CoordinateMap,
  pdfDoc: PDFDocument
): Promise<void> {
  const { drawTextFieldExact, drawMultiLineTextExact, drawCheckboxExact, drawSignatureExact } = await import('./renderUtils');
  
  const textFieldMappings = [
    { field: 'name', value: data.name },
    { field: 'pan', value: data.pan },
    { field: 'latest_ay', value: data.latest_ay },
    { field: 'income_amount', value: data.income_amount },
    { field: 'nature_income', value: data.nature_income },
    { field: 'section', value: data.section }
  ];

  for (const mapping of textFieldMappings) {
    const inputBox = coordinateMap.fields[mapping.field];
    if (inputBox && mapping.value) {
      await drawTextFieldExact(page, font, mapping.value, inputBox, coordinateMap.pageWidth, coordinateMap.pageHeight);
    }
  }

  if (data.address && coordinateMap.fields.address) {
    await drawMultiLineTextExact(page, font, data.address, coordinateMap.fields.address, coordinateMap.pageWidth, coordinateMap.pageHeight);
  }

  const checkboxMappings = [
    { field: 'assessed_yes', value: data.assessed_yes },
    { field: 'assessed_no', value: data.assessed_no }
  ];

  for (const mapping of checkboxMappings) {
    const inputBox = coordinateMap.fields[mapping.field];
    if (inputBox && mapping.value) {
      await drawCheckboxExact(page, mapping.value, inputBox, coordinateMap.pageWidth, coordinateMap.pageHeight);
    }
  }

  if (data.signature && coordinateMap.fields.signature) {
    await drawSignatureExact(page, data.signature, coordinateMap.fields.signature, coordinateMap.pageWidth, coordinateMap.pageHeight, pdfDoc);
  }
}

async function renderDebugOverlayExact(page: PDFPage, font: any, coordinateMap: CoordinateMap): Promise<void> {
  const { pageWidth, pageHeight } = coordinateMap;
  const gridSize = 20;
  const gridColor = rgb(0.9, 0.9, 0.9);

  for (let x = 0; x <= pageWidth; x += gridSize) {
    page.drawLine({ start: { x, y: 0 }, end: { x, y: pageHeight }, thickness: 0.5, color: gridColor });
  }

  for (let y = 0; y <= pageHeight; y += gridSize) {
    page.drawLine({ start: { x: 0, y }, end: { x: pageWidth, y }, thickness: 0.5, color: gridColor });
  }

  Object.entries(coordinateMap.anchors).forEach(([fieldKey, anchor]) => {
    page.drawCircle({ x: anchor.x, y: anchor.y, size: 4, color: rgb(0, 1, 0), opacity: 0.7 });
    page.drawText(`${fieldKey}`, { x: anchor.x + 6, y: anchor.y + 6, size: 8, font, color: rgb(0, 1, 0) });
  });
}