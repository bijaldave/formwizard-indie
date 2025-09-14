import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Profile, DividendRow, FieldMapping } from '@/types';
import { getAgeFromDOB } from './validation';

// Form 15G field mappings - Optimized with coordinate extraction and font sizing
const FORM_15G_FIELDS: Record<string, FieldMapping> = {
  // Personal Information - Font optimized based on field width
  name: { x: 135, y: 727, width: 180, height: 16, fontSize: 9, maxWidth: 178 },
  pan: { x: 325, y: 727, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
  status_individual: { x: 37, y: 709, width: 10, height: 10, fontSize: 10 },
  status_huf: { x: 90, y: 709, width: 10, height: 10, fontSize: 10 },
  
  // Previous Year & Residential Status - Small field optimized
  previous_year: { x: 233, y: 709, width: 50, height: 16, fontSize: 7, maxWidth: 48 },
  resident_indian: { x: 340, y: 709, width: 10, height: 10, fontSize: 10 },
  resident_nri: { x: 420, y: 709, width: 10, height: 10, fontSize: 10 },
  
  // Address Fields - Consistent font sizing based on field width
  addr_flat: { x: 135, y: 687, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
  addr_premises: { x: 260, y: 687, width: 140, height: 16, fontSize: 8, maxWidth: 138 },
  addr_street: { x: 135, y: 667, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
  addr_area: { x: 260, y: 667, width: 140, height: 16, fontSize: 8, maxWidth: 138 },
  addr_city: { x: 135, y: 647, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
  addr_state: { x: 260, y: 647, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
  addr_pin: { x: 365, y: 647, width: 70, height: 16, fontSize: 8, maxWidth: 68 },
  
  // Contact Information
  email: { x: 135, y: 627, width: 150, height: 16, fontSize: 8, maxWidth: 148 },
  phone: { x: 300, y: 627, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
  
  // Tax Assessment
  assessed_yes: { x: 350, y: 592, width: 10, height: 10, fontSize: 10 },
  assessed_no: { x: 380, y: 592, width: 10, height: 10, fontSize: 10 },
  latest_ay: { x: 135, y: 572, width: 80, height: 16, fontSize: 8, maxWidth: 78 },
  
  // Income Information
  income_for_decl: { x: 135, y: 537, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
  income_total_fy: { x: 300, y: 537, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
  other_forms_count: { x: 135, y: 517, width: 80, height: 16, fontSize: 8, maxWidth: 78 },
  other_forms_amount: { x: 300, y: 517, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
  
  // Investment Table - 5 column structure corrected (BOID moved to table)
  incomeTbl_slno: { x: 40, y: 472, width: 30, height: 16, fontSize: 7, maxWidth: 28 },
  incomeTbl_id: { x: 75, y: 472, width: 120, height: 16, fontSize: 7, maxWidth: 118 },
  incomeTbl_nature: { x: 200, y: 472, width: 100, height: 16, fontSize: 7, maxWidth: 98 },
  incomeTbl_section: { x: 305, y: 472, width: 60, height: 16, fontSize: 7, maxWidth: 58 },
  incomeTbl_amount: { x: 370, y: 472, width: 80, height: 16, fontSize: 7, maxWidth: 78, align: 'right' },
  
  // Signature
  signature: { x: 350, y: 372, width: 100, height: 40, fontSize: 10, maxWidth: 98 }
};

// Form 15H field mappings - Optimized with coordinate extraction and font sizing
const FORM_15H_FIELDS: Record<string, FieldMapping> = {
  // Personal Information - Font optimized based on field width
  name: { x: 83, y: 688, width: 428, height: 18, fontSize: 10, maxWidth: 425 },
  pan: { x: 83, y: 648, width: 179, height: 18, fontSize: 9, maxWidth: 175 },
  dob: { x: 393, y: 648, width: 119, height: 18, fontSize: 8, maxWidth: 115 },
  status_individual: { x: 37, y: 625, width: 10, height: 10, fontSize: 10 },
  status_huf: { x: 90, y: 625, width: 10, height: 10, fontSize: 10 },
  
  // Address Fields - Consistent font sizing
  addr_flat: { x: 83, y: 602, width: 179, height: 18, fontSize: 8, maxWidth: 175 },
  addr_premises: { x: 298, y: 602, width: 214, height: 18, fontSize: 8, maxWidth: 210 },
  addr_street: { x: 83, y: 580, width: 179, height: 18, fontSize: 8, maxWidth: 175 },
  addr_area: { x: 298, y: 580, width: 214, height: 18, fontSize: 8, maxWidth: 210 },
  addr_city: { x: 83, y: 557, width: 179, height: 18, fontSize: 8, maxWidth: 175 },
  addr_state: { x: 298, y: 557, width: 119, height: 18, fontSize: 8, maxWidth: 115 },
  addr_pin: { x: 440, y: 557, width: 71, height: 18, fontSize: 8, maxWidth: 70 },
  
  // Contact Information
  email: { x: 83, y: 534, width: 179, height: 18, fontSize: 8, maxWidth: 175 },
  phone: { x: 298, y: 534, width: 214, height: 18, fontSize: 8, maxWidth: 210 },
  
  // Tax Assessment
  assessed_yes: { x: 125, y: 510, width: 11, height: 15, fontSize: 10 },
  assessed_no: { x: 155, y: 510, width: 11, height: 15, fontSize: 10 },
  latest_ay: { x: 393, y: 510, width: 119, height: 18, fontSize: 8, maxWidth: 115 },
  
  // Income Information  
  income_for_decl: { x: 83, y: 486, width: 179, height: 18, fontSize: 8, maxWidth: 175 },
  income_total_fy: { x: 298, y: 463, width: 214, height: 18, fontSize: 8, maxWidth: 210 },
  other_forms_count: { x: 83, y: 439, width: 179, height: 18, fontSize: 8, maxWidth: 175 },
  other_forms_amount: { x: 298, y: 439, width: 214, height: 18, fontSize: 8, maxWidth: 210 },
  
  // Investment Table - 5 column structure
  incomeTbl_slno: { x: 40, y: 396, width: 30, height: 18, fontSize: 7, maxWidth: 28 },
  incomeTbl_id: { x: 83, y: 396, width: 155, height: 18, fontSize: 7, maxWidth: 150 },
  incomeTbl_nature: { x: 244, y: 396, width: 131, height: 18, fontSize: 7, maxWidth: 125 },
  incomeTbl_section: { x: 381, y: 396, width: 42, height: 18, fontSize: 7, maxWidth: 40 },
  incomeTbl_amount: { x: 434, y: 396, width: 77, height: 18, fontSize: 7, maxWidth: 75, align: 'right' },
  
  // Signature
  signature: { x: 399, y: 156, width: 131, height: 38, fontSize: 10, maxWidth: 128 }
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
  drawText('income_for_decl', String(profile.income_for_decl ?? ''));
  drawText('income_total_fy', String(profile.income_total_fy ?? ''));
  drawText('other_forms_count', String(profile.other_forms_count ?? ''));
  drawText('other_forms_amount', String(profile.other_forms_amount ?? ''));
  
  // Investment Table - Fixed structure with 5 columns
  drawText('incomeTbl_slno', '1');
  drawText('incomeTbl_id', profile.boid || '');
  drawText('incomeTbl_nature', 'Dividend on equity shares');
  drawText('incomeTbl_section', '194');
  drawText('incomeTbl_amount', String(dividend.total ?? ''));
  
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