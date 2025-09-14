import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Profile, DividendRow, FieldMapping } from '@/types';
import { getAgeFromDOB } from './validation';

// Field mappings for Form 15G - Precise absolute coordinates (A4 PDF: 595x842 points)
const FORM_15G_FIELDS: Record<string, FieldMapping> = {
  // Personal Information Section
  name: { x: 180, y: 720, width: 240, height: 15, fontSize: 10, maxWidth: 240 },
  pan: { x: 450, y: 720, width: 100, height: 15, fontSize: 10, maxWidth: 100 },
  dob: { x: 180, y: 695, width: 80, height: 15, fontSize: 10, maxWidth: 80 },
  
  // Status checkboxes
  status_individual: { x: 120, y: 670, width: 12, height: 12, fontSize: 12 },
  status_huf: { x: 180, y: 670, width: 12, height: 12, fontSize: 12 },
  
  // Previous year and residential status
  previous_year: { x: 380, y: 695, width: 80, height: 15, fontSize: 10, maxWidth: 80 },
  resident_yes: { x: 200, y: 645, width: 12, height: 12, fontSize: 12 },
  resident_no: { x: 300, y: 645, width: 12, height: 12, fontSize: 12 },
  
  // Address Fields
  addr_flat: { x: 150, y: 620, width: 120, height: 15, fontSize: 9, maxWidth: 115 },
  addr_premises: { x: 300, y: 620, width: 120, height: 15, fontSize: 9, maxWidth: 115 },
  addr_street: { x: 450, y: 620, width: 120, height: 15, fontSize: 9, maxWidth: 115 },
  addr_area: { x: 150, y: 595, width: 120, height: 15, fontSize: 9, maxWidth: 115 },
  addr_city: { x: 300, y: 595, width: 120, height: 15, fontSize: 9, maxWidth: 115 },
  addr_state: { x: 450, y: 595, width: 100, height: 15, fontSize: 9, maxWidth: 95 },
  addr_pin: { x: 150, y: 570, width: 80, height: 15, fontSize: 9, maxWidth: 75 },
  email: { x: 250, y: 570, width: 150, height: 15, fontSize: 9, maxWidth: 145 },
  phone: { x: 420, y: 570, width: 120, height: 15, fontSize: 9, maxWidth: 115 },
  
  // Assessment Details
  assessed_yes: { x: 520, y: 545, width: 12, height: 12, fontSize: 12 },
  assessed_no: { x: 550, y: 545, width: 12, height: 12, fontSize: 12 },
  latest_ay: { x: 200, y: 520, width: 100, height: 15, fontSize: 9, maxWidth: 95 },
  
  // Income Details
  income_nature: { x: 80, y: 495, width: 150, height: 15, fontSize: 9, maxWidth: 145 },
  income_estimated: { x: 280, y: 495, width: 100, height: 15, fontSize: 10, align: 'right', maxWidth: 95 },
  income_total: { x: 450, y: 495, width: 100, height: 15, fontSize: 10, align: 'right', maxWidth: 95 },
  
  // Previous Forms
  other_forms_count: { x: 280, y: 470, width: 50, height: 15, fontSize: 9, align: 'center', maxWidth: 45 },
  other_forms_amount: { x: 450, y: 470, width: 100, height: 15, fontSize: 9, align: 'right', maxWidth: 95 },
  
  // BO ID
  boid: { x: 150, y: 445, width: 200, height: 15, fontSize: 9, maxWidth: 195 },
  
  // Signature
  signature: { x: 420, y: 120, width: 150, height: 50 },
};

// Field mappings for Form 15H - Absolute coordinates (keeping existing working coordinates converted)
const FORM_15H_FIELDS: Record<string, FieldMapping> = {
  name: { x: 83, y: 688, width: 428, height: 18, fontSize: 10, maxWidth: 425 },
  pan: { x: 83, y: 648, width: 179, height: 18, fontSize: 10, maxWidth: 175 },
  dob: { x: 393, y: 648, width: 119, height: 18, fontSize: 10, maxWidth: 115 },
  pyLabel: { x: 83, y: 625, width: 179, height: 18, fontSize: 10, maxWidth: 175 },
  addr_flat: { x: 83, y: 602, width: 179, height: 18, fontSize: 9, maxWidth: 175 },
  addr_prem: { x: 298, y: 602, width: 214, height: 18, fontSize: 9, maxWidth: 210 },
  addr_street: { x: 83, y: 580, width: 179, height: 18, fontSize: 9, maxWidth: 175 },
  addr_area: { x: 298, y: 580, width: 214, height: 18, fontSize: 9, maxWidth: 210 },
  addr_city: { x: 83, y: 557, width: 179, height: 18, fontSize: 9, maxWidth: 175 },
  addr_state: { x: 298, y: 557, width: 119, height: 18, fontSize: 9, maxWidth: 115 },
  addr_pin: { x: 440, y: 557, width: 71, height: 18, fontSize: 9, maxWidth: 70 },
  email: { x: 83, y: 534, width: 179, height: 18, fontSize: 9, maxWidth: 175 },
  phone: { x: 298, y: 534, width: 214, height: 18, fontSize: 9, maxWidth: 210 },
  assessedYes: { x: 125, y: 510, width: 11, height: 15, fontSize: 12 },
  assessedNo: { x: 155, y: 510, width: 11, height: 15, fontSize: 12 },
  latestAY: { x: 393, y: 510, width: 119, height: 18, fontSize: 9, maxWidth: 115 },
  incomeFor: { x: 83, y: 486, width: 179, height: 18, fontSize: 9, maxWidth: 175 },
  incomeTotal: { x: 298, y: 463, width: 214, height: 18, fontSize: 9, maxWidth: 210 },
  otherCnt: { x: 83, y: 439, width: 179, height: 18, fontSize: 9, maxWidth: 175 },
  otherAmt: { x: 298, y: 439, width: 214, height: 18, fontSize: 9, maxWidth: 210 },
  incomeTbl_ident: { x: 83, y: 396, width: 155, height: 18, fontSize: 8, maxWidth: 150 },
  incomeTbl_nature: { x: 244, y: 396, width: 131, height: 18, fontSize: 8, maxWidth: 125 },
  incomeTbl_section: { x: 381, y: 396, width: 42, height: 18, fontSize: 8, maxWidth: 40 },
  incomeTbl_amount: { x: 434, y: 396, width: 77, height: 18, fontSize: 8, maxWidth: 75 },
  boid: { x: 83, y: 417, width: 238, height: 18, fontSize: 9, maxWidth: 235 },
  signature: { x: 399, y: 156, width: 131, height: 38 },
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

  // Helper function to draw text in field with enhanced alignment
  const drawText = (fieldName: string, text: string) => {
    const field = fields[fieldName];
    if (!field || !text) return;
    
    const x = field.x;
    const y = field.y;
    const maxWidth = field.maxWidth || field.width;
    const textAlign = field.align || 'left';
    const textSize = field.fontSize || fontSize;
    
    let actualX = x;
    
    // Handle text alignment
    if (textAlign === 'right') {
      const textWidth = font.widthOfTextAtSize(sanitizeText(text), textSize);
      actualX = x + maxWidth - Math.min(textWidth, maxWidth);
    } else if (textAlign === 'center') {
      const textWidth = font.widthOfTextAtSize(sanitizeText(text), textSize);
      actualX = x + (maxWidth - Math.min(textWidth, maxWidth)) / 2;
    }
    
    firstPage.drawText(sanitizeText(text), {
      x: actualX,
      y: y,
      size: textSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth,
    });
  };
  
  // Helper function to draw checkbox with precise positioning
  const drawCheckbox = (fieldName: string, checked: boolean) => {
    const field = fields[fieldName];
    if (!field || !checked) return;
    
    const x = field.x;
    const y = field.y;
    
    firstPage.drawText('X', {
      x: x + 2,
      y: y + 2,
      size: field.fontSize || 12,
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
  
  // Note: Dividend amount field removed as not required
  
  // Signature
  if (profile.signature && fields.signature) {
    const signatureField = fields.signature;
    const x = signatureField.x;
    const y = signatureField.y;
    const w = signatureField.width;
    const h = signatureField.height;
    
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