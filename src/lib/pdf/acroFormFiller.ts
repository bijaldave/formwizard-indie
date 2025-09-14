import { PDFDocument, PDFPage } from 'pdf-lib';
import { Form15GData } from './fill15G';
import { Form15HData } from './fill15H';
import { loadAcroFormShell, validateAcroFormShell, getSignaturePercentRect } from './calibration';

/**
 * Fill Form 15G using AcroForm approach
 */
export async function fillForm15GAcroForm(
  templateFile: File,
  data: Form15GData
): Promise<Uint8Array> {
  try {
    // Validate AcroForm shell
    const validation = await validateAcroFormShell(templateFile, '15G');
    if (!validation.valid) {
      throw new Error(`AcroForm validation failed: ${validation.reason}`);
    }
    
    // Load AcroForm shell
    const shellBytes = await loadAcroFormShell('15G');
    if (!shellBytes) {
      throw new Error('AcroForm shell not found');
    }
    
    // Load the AcroForm PDF
    const pdfDoc = await PDFDocument.load(shellBytes);
    const form = pdfDoc.getForm();
    
    // Map data to form fields
    const fieldMappings = {
      'name': data.name,
      'pan': data.pan,
      'addr_line1': data.addr_flat,
      'addr_line2': data.addr_premises,
      'addr_line3': `${data.addr_street}, ${data.addr_area}`,
      'phone': data.phone,
      'email': data.email,
      'income_ident': data.boid,
      'income_nature': data.nature_income,
      'income_section': data.section,
      'income_amount': data.dividend_amount,
      'place_date': data.place_date,
      'declaration_amount': data.estimated_income_total
    };
    
    // Fill text fields
    Object.entries(fieldMappings).forEach(([fieldName, value]) => {
      if (value) {
        try {
          const field = form.getTextField(fieldName);
          field.setText(value.toString());
        } catch (error) {
          console.warn(`Field ${fieldName} not found in form`);
        }
      }
    });
    
    // Fill checkboxes
    const checkboxMappings = {
      'resident_yes': data.residential_status === 'Resident',
      'resident_no': data.residential_status === 'Non-Resident',
      'assessed_yes': data.assessed_yes,
      'assessed_no': data.assessed_no
    };
    
    Object.entries(checkboxMappings).forEach(([fieldName, checked]) => {
      if (checked) {
        try {
          const field = form.getCheckBox(fieldName);
          field.check();
        } catch (error) {
          console.warn(`Checkbox ${fieldName} not found in form`);
        }
      }
    });
    
    // Handle signature manually (not an AcroForm field)
    if (data.signature) {
      await embedSignatureImage(pdfDoc, data.signature, '15G');
    }
    
    // Flatten the form to prevent further editing
    form.flatten();
    
    return await pdfDoc.save();
    
  } catch (error) {
    console.error('Error filling Form 15G with AcroForm:', error);
    throw new Error(`AcroForm filling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fill Form 15H using AcroForm approach
 */
export async function fillForm15HAcroForm(
  templateFile: File,
  data: Form15HData
): Promise<Uint8Array> {
  try {
    // Validate AcroForm shell
    const validation = await validateAcroFormShell(templateFile, '15H');
    if (!validation.valid) {
      throw new Error(`AcroForm validation failed: ${validation.reason}`);
    }
    
    // Load AcroForm shell
    const shellBytes = await loadAcroFormShell('15H');
    if (!shellBytes) {
      throw new Error('AcroForm shell not found');
    }
    
    // Load the AcroForm PDF
    const pdfDoc = await PDFDocument.load(shellBytes);
    const form = pdfDoc.getForm();
    
    // Map data to form fields
    const fieldMappings = {
      'name': data.name,
      'pan': data.pan,
      'address': data.address,
      'phone': '', // 15H doesn't have separate phone field in our current mapping
      'email': '', // 15H doesn't have separate email field in our current mapping
      'income_ident': data.boid,
      'income_nature': data.nature_income,
      'income_section': data.section,
      'income_amount': data.dividend_amount,
      'place_date': data.place_date,
      'declaration_amount': data.estimated_income_total
    };
    
    // Fill text fields
    Object.entries(fieldMappings).forEach(([fieldName, value]) => {
      if (value) {
        try {
          const field = form.getTextField(fieldName);
          field.setText(value.toString());
        } catch (error) {
          console.warn(`Field ${fieldName} not found in form`);
        }
      }
    });
    
    // Fill checkboxes
    const checkboxMappings = {
      'resident_yes': data.residential_status === 'Resident',
      'resident_no': data.residential_status === 'Non-Resident',
      'assessed_yes': data.assessed_yes,
      'assessed_no': data.assessed_no
    };
    
    Object.entries(checkboxMappings).forEach(([fieldName, checked]) => {
      if (checked) {
        try {
          const field = form.getCheckBox(fieldName);
          field.check();
        } catch (error) {
          console.warn(`Checkbox ${fieldName} not found in form`);
        }
      }
    });
    
    // Handle signature manually (not an AcroForm field)
    if (data.signature) {
      await embedSignatureImage(pdfDoc, data.signature, '15H');
    }
    
    // Flatten the form to prevent further editing
    form.flatten();
    
    return await pdfDoc.save();
    
  } catch (error) {
    console.error('Error filling Form 15H with AcroForm:', error);
    throw new Error(`AcroForm filling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Embed signature image at calibrated coordinates
 */
async function embedSignatureImage(
  pdfDoc: PDFDocument,
  signatureBase64: string,
  formType: string
): Promise<void> {
  try {
    const percentRect = await getSignaturePercentRect(formType);
    if (!percentRect) {
      console.warn('No signature coordinates found, skipping signature');
      return;
    }
    
    // Convert base64 to image
    const signatureData = signatureBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const signatureBytes = Uint8Array.from(atob(signatureData), c => c.charCodeAt(0));
    
    // Embed image
    const signatureImage = await pdfDoc.embedPng(signatureBytes);
    
    // Get first page size
    const page = pdfDoc.getPage(0);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    
    // Compute absolute coords from percent rect
    const width = percentRect.wPct * pageWidth;
    const height = percentRect.hPct * pageHeight;
    const x = percentRect.xPct * pageWidth;
    const y = pageHeight - (percentRect.yPct * pageHeight) - height;
    
    // Draw signature image
    page.drawImage(signatureImage, { x, y, width, height });
    
  } catch (error) {
    console.error('Error embedding signature:', error);
    // Don't throw error, just log it - form can still be generated without signature
  }
}