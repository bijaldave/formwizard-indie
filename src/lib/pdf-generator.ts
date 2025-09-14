import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Profile, DividendRow, FieldMapping } from '@/types';
import { getAgeFromDOB } from './validation';

// Field mappings for Form 15G - Part A
const FORM_15G_FIELDS: Record<string, FieldMapping> = {
  name: { xPct: 0.14, yPct: 0.83, wPct: 0.72, hPct: 0.022 },
  pan: { xPct: 0.14, yPct: 0.79, wPct: 0.30, hPct: 0.022 },
  dob: { xPct: 0.66, yPct: 0.79, wPct: 0.20, hPct: 0.022 },
  residentYes: { xPct: 0.14, yPct: 0.865, wPct: 0.018, hPct: 0.018 },
  residentNo: { xPct: 0.20, yPct: 0.865, wPct: 0.018, hPct: 0.018 },
  address: { xPct: 0.14, yPct: 0.745, wPct: 0.72, hPct: 0.070, lineClamp: 4 },
  email: { xPct: 0.14, yPct: 0.676, wPct: 0.40, hPct: 0.022 },
  phone: { xPct: 0.66, yPct: 0.676, wPct: 0.20, hPct: 0.022 },
  assessedYes: { xPct: 0.14, yPct: 0.647, wPct: 0.018, hPct: 0.018 },
  assessedNo: { xPct: 0.20, yPct: 0.647, wPct: 0.018, hPct: 0.018 },
  latestAY: { xPct: 0.66, yPct: 0.647, wPct: 0.20, hPct: 0.022 },
  pyLabel: { xPct: 0.66, yPct: 0.612, wPct: 0.20, hPct: 0.022 },
  incomeFor: { xPct: 0.66, yPct: 0.595, wPct: 0.20, hPct: 0.022 },
  incomeTotal: { xPct: 0.66, yPct: 0.579, wPct: 0.20, hPct: 0.022 },
  otherCnt: { xPct: 0.66, yPct: 0.546, wPct: 0.20, hPct: 0.022 },
  otherAmt: { xPct: 0.66, yPct: 0.513, wPct: 0.20, hPct: 0.022 },
  boid: { xPct: 0.14, yPct: 0.513, wPct: 0.40, hPct: 0.022 },
  incomeTbl_ident: { xPct: 0.14, yPct: 0.445, wPct: 0.30, hPct: 0.022 },
  incomeTbl_nature: { xPct: 0.45, yPct: 0.445, wPct: 0.18, hPct: 0.022 },
  incomeTbl_section: { xPct: 0.64, yPct: 0.445, wPct: 0.07, hPct: 0.022 },
  incomeTbl_amount: { xPct: 0.73, yPct: 0.445, wPct: 0.13, hPct: 0.022 },
  signature: { xPct: 0.67, yPct: 0.205, wPct: 0.22, hPct: 0.045 },
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
  const templateBytes = await fetch(templatePath).then(res => res.arrayBuffer());
  
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  
  // Embed font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  
  // Helper function to draw text in field
  const drawText = (fieldName: string, text: string) => {
    const field = fields[fieldName];
    if (!field) return;
    
    const x = width * field.xPct;
    const y = height * (1 - field.yPct - field.hPct);
    const maxWidth = width * field.wPct;
    
    firstPage.drawText(text, {
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
    
    firstPage.drawText('✓', {
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
  
  // Address handling
  if (formType === '15G') {
    const address = [
      profile.addr_flat,
      profile.addr_premises,
      profile.addr_street + ', ' + profile.addr_area,
      profile.addr_city + ', ' + profile.addr_state + ' - ' + profile.addr_pin
    ].filter(Boolean).join('\n');
    drawText('address', address);
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
  
  // Checkboxes
  drawCheckbox('residentYes', profile.resident);
  drawCheckbox('residentNo', !profile.resident);
  drawCheckbox('assessedYes', profile.assessed_to_tax === 'Yes');
  drawCheckbox('assessedNo', profile.assessed_to_tax === 'No');
  
  // Income information
  if (profile.assessed_to_tax === 'Yes') {
    drawText('latestAY', profile.latest_ay);
  }
  drawText('pyLabel', profile.fy_label);
  drawText('incomeFor', profile.income_for_decl.toString());
  drawText('incomeTotal', profile.income_total_fy.toString());
  drawText('otherCnt', profile.other_forms_count.toString());
  drawText('otherAmt', profile.other_forms_amount.toString());
  
  // BO ID
  drawText('boid', profile.boid);
  
  // Income table - dividend details
  drawText('incomeTbl_ident', profile.boid);
  drawText('incomeTbl_nature', 'Dividend on equity shares');
  drawText('incomeTbl_section', '194');
  drawText('incomeTbl_amount', dividend.total.toString());
  
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