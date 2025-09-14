import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Profile, DividendRow, FieldMapping } from '@/types';
import { getAgeFromDOB } from './validation';

// Form 15G field mappings - Updated with corrected coordinates and field names
const FORM_15G_FIELDS: Record<string, FieldMapping> = {
  // Personal Information - Corrected coordinates and optimized font sizes
  name: { x: 120, y: 727, width: 200, height: 18, fontSize: 10, maxWidth: 198 },
  pan: { x: 350, y: 727, width: 120, height: 18, fontSize: 10, maxWidth: 118 },
  
  // Status checkboxes - Corrected positioning
  status_individual: { x: 55, y: 707, width: 12, height: 12, fontSize: 10 },
  status_huf: { x: 125, y: 707, width: 12, height: 12, fontSize: 10 },
  
  // Previous Year
  previous_year: { x: 280, y: 707, width: 60, height: 16, fontSize: 8, maxWidth: 58 },
  
  // Residential Status - Corrected field names and positioning
  residential_status_indian: { x: 380, y: 707, width: 12, height: 12, fontSize: 10 },
  residential_status_nri: { x: 450, y: 707, width: 12, height: 12, fontSize: 10 },
  
  // Address Fields - Improved positioning and sizing
  addr_flat: { x: 120, y: 682, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
  addr_premises: { x: 280, y: 682, width: 160, height: 16, fontSize: 9, maxWidth: 158 },
  addr_street: { x: 120, y: 657, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
  addr_area: { x: 280, y: 657, width: 160, height: 16, fontSize: 9, maxWidth: 158 },
  addr_city: { x: 120, y: 632, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
  addr_state: { x: 280, y: 632, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
  addr_pin: { x: 400, y: 632, width: 80, height: 16, fontSize: 9, maxWidth: 78 },
  
  // Contact Information
  email: { x: 120, y: 607, width: 180, height: 16, fontSize: 9, maxWidth: 178 },
  phone: { x: 320, y: 607, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  
  // Tax Assessment - Corrected positioning
  assessed_yes: { x: 380, y: 567, width: 12, height: 12, fontSize: 10 },
  assessed_no: { x: 420, y: 567, width: 12, height: 12, fontSize: 10 },
  latest_ay: { x: 120, y: 542, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
  
  // Income Information - Better spacing
  income_for_decl: { x: 120, y: 502, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  income_total_fy: { x: 320, y: 502, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  other_forms_count: { x: 120, y: 477, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
  other_forms_amount: { x: 320, y: 477, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  
  // Investment Table - Corrected structure with BOID column
  incomeTbl_slno: { x: 50, y: 422, width: 25, height: 16, fontSize: 8, maxWidth: 23 },
  incomeTbl_boid: { x: 80, y: 422, width: 110, height: 16, fontSize: 8, maxWidth: 108 },
  incomeTbl_nature: { x: 195, y: 422, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
  incomeTbl_section: { x: 320, y: 422, width: 70, height: 16, fontSize: 8, maxWidth: 68 },
  incomeTbl_amount: { x: 395, y: 422, width: 85, height: 16, fontSize: 8, maxWidth: 83, align: 'right' },
  
  // Signature
  signature: { x: 350, y: 322, width: 120, height: 50, fontSize: 10, maxWidth: 118 }
};

// Form 15H field mappings - Updated with corrected coordinates and field names
const FORM_15H_FIELDS: Record<string, FieldMapping> = {
  // Personal Information - Corrected coordinates and optimized font sizes
  name: { x: 120, y: 707, width: 200, height: 18, fontSize: 10, maxWidth: 198 },
  pan: { x: 350, y: 707, width: 120, height: 18, fontSize: 10, maxWidth: 118 },
  dob: { x: 120, y: 687, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  
  // Status checkboxes - Corrected positioning
  status_individual: { x: 55, y: 667, width: 12, height: 12, fontSize: 10 },
  status_huf: { x: 125, y: 667, width: 12, height: 12, fontSize: 10 },
  
  // Address Fields - Improved positioning for 15H
  addr_flat: { x: 120, y: 642, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
  addr_premises: { x: 280, y: 642, width: 160, height: 16, fontSize: 9, maxWidth: 158 },
  addr_street: { x: 120, y: 617, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
  addr_area: { x: 280, y: 617, width: 160, height: 16, fontSize: 9, maxWidth: 158 },
  addr_city: { x: 120, y: 592, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
  addr_state: { x: 280, y: 592, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
  addr_pin: { x: 400, y: 592, width: 80, height: 16, fontSize: 9, maxWidth: 78 },
  
  // Contact Information
  email: { x: 120, y: 567, width: 180, height: 16, fontSize: 9, maxWidth: 178 },
  phone: { x: 320, y: 567, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  
  // Tax Assessment (15H doesn't have assessed_yes/no fields)
  latest_ay: { x: 120, y: 522, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
  
  // Income Information
  income_for_decl: { x: 120, y: 482, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  income_total_fy: { x: 320, y: 482, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  other_forms_count: { x: 120, y: 457, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
  other_forms_amount: { x: 320, y: 457, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
  
  // Investment Table - Same structure as 15G with BOID column
  incomeTbl_slno: { x: 50, y: 402, width: 25, height: 16, fontSize: 8, maxWidth: 23 },
  incomeTbl_boid: { x: 80, y: 402, width: 110, height: 16, fontSize: 8, maxWidth: 108 },
  incomeTbl_nature: { x: 195, y: 402, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
  incomeTbl_section: { x: 320, y: 402, width: 70, height: 16, fontSize: 8, maxWidth: 68 },
  incomeTbl_amount: { x: 395, y: 402, width: 85, height: 16, fontSize: 8, maxWidth: 83, align: 'right' },
  
  // Signature
  signature: { x: 350, y: 302, width: 120, height: 50, fontSize: 10, maxWidth: 118 }
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
  
  // Residential status checkboxes - corrected field names
  drawCheckbox('residential_status_indian', profile.residential_status === 'Indian');
  drawCheckbox('residential_status_nri', profile.residential_status === 'NRI');
  
  // Assessment checkboxes (only for 15G)
  if (formType === '15G') {
    drawCheckbox('assessed_yes', profile.assessed_to_tax === 'Yes');
    drawCheckbox('assessed_no', profile.assessed_to_tax === 'No');
  }
  
  // Income information
  if (profile.assessed_to_tax === 'Yes') {
    drawText('latest_ay', profile.latest_ay || '');
  }
  
  // Income details
  drawText('income_for_decl', String(profile.income_for_decl ?? ''));
  drawText('income_total_fy', String(profile.income_total_fy ?? ''));
  drawText('other_forms_count', String(profile.other_forms_count ?? ''));
  drawText('other_forms_amount', String(profile.other_forms_amount ?? ''));
  
  // Investment Table - Corrected to use BOID field
  drawText('incomeTbl_slno', '1');
  drawText('incomeTbl_boid', profile.boid || '');
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