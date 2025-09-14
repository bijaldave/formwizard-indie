import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Profile, DividendRow, FieldMapping } from '@/types';
import { getAgeFromDOB } from './validation';

// Field mappings for Form 15G - Part A (Based on filled form analysis)
const FORM_15G_FIELDS: Record<string, FieldMapping> = {
  name: { xPct: 0.35, yPct: 0.162, wPct: 0.50, hPct: 0.020 },
  pan: { xPct: 0.35, yPct: 0.197, wPct: 0.25, hPct: 0.020 },
  dob: { xPct: 0.65, yPct: 0.197, wPct: 0.20, hPct: 0.020 },
  status_individual: { xPct: 0.28, yPct: 0.232, wPct: 0.015, hPct: 0.015 },
  status_huf: { xPct: 0.37, yPct: 0.232, wPct: 0.015, hPct: 0.015 },
  previous_year: { xPct: 0.35, yPct: 0.267, wPct: 0.20, hPct: 0.020 },
  resident_yes: { xPct: 0.28, yPct: 0.302, wPct: 0.015, hPct: 0.015 },
  resident_no: { xPct: 0.35, yPct: 0.302, wPct: 0.015, hPct: 0.015 },
  addr_flat: { xPct: 0.35, yPct: 0.337, wPct: 0.50, hPct: 0.020 },
  addr_premises: { xPct: 0.35, yPct: 0.372, wPct: 0.50, hPct: 0.020 },
  addr_street: { xPct: 0.35, yPct: 0.407, wPct: 0.50, hPct: 0.020 },
  addr_area: { xPct: 0.35, yPct: 0.442, wPct: 0.25, hPct: 0.020 },
  addr_city: { xPct: 0.62, yPct: 0.442, wPct: 0.23, hPct: 0.020 },
  addr_state: { xPct: 0.35, yPct: 0.477, wPct: 0.25, hPct: 0.020 },
  addr_pin: { xPct: 0.62, yPct: 0.477, wPct: 0.15, hPct: 0.020 },
  email: { xPct: 0.35, yPct: 0.512, wPct: 0.50, hPct: 0.020 },
  phone: { xPct: 0.35, yPct: 0.547, wPct: 0.25, hPct: 0.020 },
  assessed_yes: { xPct: 0.28, yPct: 0.582, wPct: 0.015, hPct: 0.015 },
  assessed_no: { xPct: 0.35, yPct: 0.582, wPct: 0.015, hPct: 0.015 },
  latest_ay: { xPct: 0.50, yPct: 0.582, wPct: 0.20, hPct: 0.020 },
  income_nature: { xPct: 0.35, yPct: 0.617, wPct: 0.25, hPct: 0.020 },
  income_estimated: { xPct: 0.62, yPct: 0.617, wPct: 0.23, hPct: 0.020 },
  income_total: { xPct: 0.35, yPct: 0.652, wPct: 0.25, hPct: 0.020 },
  other_forms_count: { xPct: 0.35, yPct: 0.687, wPct: 0.15, hPct: 0.020 },
  other_forms_amount: { xPct: 0.52, yPct: 0.687, wPct: 0.20, hPct: 0.020 },
  boid: { xPct: 0.35, yPct: 0.722, wPct: 0.40, hPct: 0.020 },
  dividend_amount: { xPct: 0.75, yPct: 0.757, wPct: 0.15, hPct: 0.020 },
  signature: { xPct: 0.65, yPct: 0.875, wPct: 0.25, hPct: 0.060 },
};

// Field mappings for Form 15H - Part I
const FORM_15H_FIELDS: Record<string, FieldMapping> = {
  name: { xPct: 0.14, yPct: 0.81, wPct: 0.72, hPct: 0.022 },
  pan: { xPct: 0.14, yPct: 0.77, wPct: 0.30, hPct: 0.022 },
  dob: { xPct: 0.66, yPct: 0.77, wPct: 0.20, hPct: 0.022 },
  pyLabel: { xPct: 0.14, yPct: 0.745, wPct: 0.30, hPct: 0.022 },
  addr_flat: { xPct: 0.14, yPct: 0.715, wPct: 0.30, hPct: 0.022 },
  addr_prem: { xPct: 0.50, yPct: 0.715, wPct: 0.36, hPct: 0.022 },
  addr_street: { xPct: 0.14, yPct: 0.688, wPct: 0.30, hPct: 0.022 },
  addr_area: { xPct: 0.50, yPct: 0.688, wPct: 0.36, hPct: 0.022 },
  addr_city: { xPct: 0.14, yPct: 0.660, wPct: 0.30, hPct: 0.022 },
  addr_state: { xPct: 0.50, yPct: 0.660, wPct: 0.20, hPct: 0.022 },
  addr_pin: { xPct: 0.74, yPct: 0.660, wPct: 0.12, hPct: 0.022 },
  email: { xPct: 0.14, yPct: 0.633, wPct: 0.30, hPct: 0.022 },
  phone: { xPct: 0.50, yPct: 0.633, wPct: 0.36, hPct: 0.022 },
  assessedYes: { xPct: 0.21, yPct: 0.605, wPct: 0.018, hPct: 0.018 },
  assessedNo: { xPct: 0.26, yPct: 0.605, wPct: 0.018, hPct: 0.018 },
  latestAY: { xPct: 0.66, yPct: 0.605, wPct: 0.20, hPct: 0.022 },
  incomeFor: { xPct: 0.14, yPct: 0.577, wPct: 0.30, hPct: 0.022 },
  incomeTotal: { xPct: 0.50, yPct: 0.550, wPct: 0.36, hPct: 0.022 },
  otherCnt: { xPct: 0.14, yPct: 0.521, wPct: 0.30, hPct: 0.022 },
  otherAmt: { xPct: 0.50, yPct: 0.521, wPct: 0.36, hPct: 0.022 },
  incomeTbl_ident: { xPct: 0.14, yPct: 0.470, wPct: 0.26, hPct: 0.022 },
  incomeTbl_nature: { xPct: 0.41, yPct: 0.470, wPct: 0.22, hPct: 0.022 },
  incomeTbl_section: { xPct: 0.64, yPct: 0.470, wPct: 0.07, hPct: 0.022 },
  incomeTbl_amount: { xPct: 0.73, yPct: 0.470, wPct: 0.13, hPct: 0.022 },
  boid: { xPct: 0.14, yPct: 0.495, wPct: 0.40, hPct: 0.022 },
  signature: { xPct: 0.67, yPct: 0.185, wPct: 0.22, hPct: 0.045 },
};

export const generatePDF = async (
  profile: Profile,
  dividend: DividendRow
): Promise<Uint8Array> => {
  const age = getAgeFromDOB(profile.dob_ddmmyyyy);
  const formType = age < 60 ? '15G' : '15H';
  const fields = formType === '15G' ? FORM_15G_FIELDS : FORM_15H_FIELDS;
  
  // Load the template PDF
  const templatePath = `/forms/${formType === '15G' ? '15G_UPDATED' : 'Form_15H'}.pdf`;
  console.log('Loading template from:', templatePath);
  
  const response = await fetch(templatePath);
  if (!response.ok) {
    throw new Error(`Failed to load PDF template from ${templatePath}. Status: ${response.status}`);
  }
  const templateBytes = await response.arrayBuffer();
  
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  
  // Embed font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  
  // Helper function to sanitize text for WinAnsi encoding
  const sanitizeText = (text: string): string => {
    return text.replace(/[^\x00-\xFF]/g, '?').replace(/✓/g, 'X');
  };

  // Helper function to draw text in field
  const drawText = (fieldName: string, text: string) => {
    const field = fields[fieldName];
    if (!field) return;
    
    const x = width * field.xPct;
    const y = height * (1 - field.yPct - field.hPct);
    const maxWidth = width * field.wPct;
    
    firstPage.drawText(sanitizeText(text), {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth,
    });
  };
  
  // Helper function to draw checkbox
  const drawCheckbox = (fieldName: string, checked: boolean) => {
    const field = fields[fieldName];
    if (!field || !checked) return;
    
    const x = width * field.xPct;
    const y = height * (1 - field.yPct - field.hPct);
    const size = width * field.wPct;
    
    firstPage.drawText('X', {
      x: x + size/4,
      y: y + size/4,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  };
  
  // Fill in the form fields
  drawText('name', profile.name);
  drawText('pan', profile.pan);
  drawText('dob', profile.dob_ddmmyyyy);
  
  // Address handling - Individual fields for 15G
  if (formType === '15G') {
    drawText('addr_flat', profile.addr_flat || '');
    drawText('addr_premises', profile.addr_premises || '');
    drawText('addr_street', profile.addr_street || '');
    drawText('addr_area', profile.addr_area || '');
    drawText('addr_city', profile.addr_city || '');
    drawText('addr_state', profile.addr_state || '');
    drawText('addr_pin', profile.addr_pin || '');
  } else {
    drawText('addr_flat', profile.addr_flat);
    drawText('addr_prem', profile.addr_premises);
    drawText('addr_street', profile.addr_street);
    drawText('addr_area', profile.addr_area);
    drawText('addr_city', profile.addr_city);
    drawText('addr_state', profile.addr_state);
    drawText('addr_pin', profile.addr_pin);
  }
  
  drawText('email', profile.email);
  drawText('phone', profile.phone);
  
  // Status checkboxes
  drawCheckbox('status_individual', profile.status === 'Individual');
  drawCheckbox('status_huf', profile.status === 'HUF');
  
  // Previous year
  drawText('previous_year', profile.fy_label || '');
  
  // Residential status checkboxes
  drawCheckbox('resident_yes', profile.residential_status === 'Indian');
  drawCheckbox('resident_no', profile.residential_status === 'NRI');
  
  // Assessment checkboxes
  drawCheckbox('assessed_yes', profile.assessed_to_tax === 'Yes');
  drawCheckbox('assessed_no', profile.assessed_to_tax === 'No');
  
  // Income information
  if (profile.assessed_to_tax === 'Yes') {
    drawText('latest_ay', profile.latest_ay || '');
  }
  
  // Income details
  drawText('income_nature', 'Dividend on equity shares');
  drawText('income_estimated', String(profile.income_for_decl ?? ''));
  drawText('income_total', String(profile.income_total_fy ?? ''));
  drawText('other_forms_count', String(profile.other_forms_count ?? ''));
  drawText('other_forms_amount', String(profile.other_forms_amount ?? ''));
  
  // BO ID
  drawText('boid', profile.boid || '');
  
  // Dividend amount in the table
  drawText('dividend_amount', String(dividend.total ?? ''));
  
  // Signature
  if (profile.signature && fields.signature) {
    const signatureField = fields.signature;
    const x = width * signatureField.xPct;
    const y = height * (1 - signatureField.yPct - signatureField.hPct);
    const w = width * signatureField.wPct;
    const h = height * signatureField.hPct;
    
    try {
      // Convert base64 signature to image
      const signatureBytes = Uint8Array.from(
        atob(profile.signature.split(',')[1]), 
        c => c.charCodeAt(0)
      );
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      const signatureDims = signatureImage.scale(0.3);
      
      firstPage.drawImage(signatureImage, {
        x: x + (w - signatureDims.width) / 2,
        y: y + (h - signatureDims.height) / 2,
        width: signatureDims.width,
        height: signatureDims.height,
      });
    } catch (error) {
      console.error('Failed to embed signature:', error);
      // Fallback to text
      drawText('signature', profile.name);
    }
  }
  
  return await pdfDoc.save();
};

export const downloadPDF = (pdfBytes: Uint8Array, filename: string) => {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
};