import { PDFDocument } from 'pdf-lib';
import { Profile, DividendRow } from '@/types';
import { getFormType } from '@/lib/utils/ageUtils';

interface FillFormParams {
  formType: '15g' | '15h';
  profile: Profile;
  dividend: DividendRow;
  signatureBytes?: Uint8Array;
}

/**
 * Clean AcroForm filler - no coordinate math, fill by field names only
 */
export async function fill15(params: FillFormParams): Promise<Blob> {
  const { formType, profile, dividend, signatureBytes } = params;
  
  try {
    // Load the AcroForm template directly from public folder
    const templatePath = `/templates/${formType.toUpperCase()}.acro.pdf`;
    const response = await fetch(templatePath);
    
    if (!response.ok) {
      throw new Error(`Template ${formType.toUpperCase()}.acro.pdf not found. Please ensure the AcroForm template exists in public/templates/`);
    }
    
    const templateBytes = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    
    // Prepare data - compute amount as qty * dps
    const amount = dividend.qty * dividend.dps;
    const currentDate = new Date();
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const yyyy = currentDate.getFullYear();
    const today = `${dd}/${mm}/${yyyy}`;
    
    // Prepare address components
    const addr_line1 = profile.addr_flat || '';
    const addr_line2 = profile.addr_premises || '';
    const addr_line3 = profile.addr_street || '';
    const addr_city = profile.addr_city || '';
    const addr_state = profile.addr_state || '';
    const addr_pin = profile.addr_pin || '';
    
    // Financial year calculations
    const fy = profile.fy_label || `${yyyy-1}-${String(yyyy).slice(-2)}`;
    const ay = profile.latest_ay || `${yyyy}-${String(yyyy+1).slice(-2)}`;
    const fy_end = `31/03/${yyyy}`;
    
    // Standard field mappings - fill by exact field names
    const textFields = {
      fullName: profile.name || '',
      pan: profile.pan || '',
      status: profile.status || '',
      addr_line1,
      addr_line2,
      addr_line3,
      addr_city,
      addr_state,
      addr_pin,
      email: profile.email || '',
      phone: profile.phone || '',
      fy,
      ay,
      fy_end,
      income_ident: profile.boid || '',
      income_nature: 'Dividend',
      income_section: '194',
      income_amount: amount.toString(),
      place: 'Mumbai', // Default, can be made configurable
      date: today
    };
    
    // Fill text fields
    Object.entries(textFields).forEach(([fieldName, value]) => {
      if (value) {
        try {
          const field = form.getTextField(fieldName);
          field.setText(value);
        } catch (error) {
          console.warn(`Text field '${fieldName}' not found in form`);
        }
      }
    });
    
    // Fill checkboxes - check exactly one of each pair
    const checkboxMappings = {
      resident_yes: profile.residential_status === 'Indian',
      resident_no: profile.residential_status === 'NRI',
      assessed_yes: profile.assessed_to_tax === 'Yes',
      assessed_no: profile.assessed_to_tax === 'No'
    };
    
    Object.entries(checkboxMappings).forEach(([fieldName, shouldCheck]) => {
      if (shouldCheck) {
        try {
          const field = form.getCheckBox(fieldName);
          field.check();
        } catch (error) {
          console.warn(`Checkbox '${fieldName}' not found in form`);
        }
      }
    });
    
    // Draw signature at hardcoded coordinates (no field, just image)
    if (signatureBytes) {
      try {
        const signatureImage = await pdfDoc.embedPng(signatureBytes);
        const page = pdfDoc.getPage(0);
        
        // Hardcoded signature box coordinates (measured once from template)
        const signatureRect = { x: 400, y: 150, width: 120, height: 40 };
        
        page.drawImage(signatureImage, signatureRect);
      } catch (error) {
        console.warn('Could not embed signature:', error);
      }
    }
    
    // Flatten form to prevent further editing
    form.flatten();
    
    // Return as Blob
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
    
  } catch (error) {
    console.error(`Error filling ${formType.toUpperCase()} form:`, error);
    throw new Error(`Form generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convenience function to determine form type and fill
 */
export async function generateForm(
  profile: Profile,
  dividend: DividendRow,
  signatureBytes?: Uint8Array
): Promise<{ blob: Blob; formType: '15g' | '15h'; filename: string }> {
  
  // Validate DPS
  if (!dividend.dps || dividend.dps === 0) {
    throw new Error(`Dividend per share (DPS) is required for ${dividend.symbol}`);
  }
  
  const formType = getFormType(profile);
  const blob = await fill15({ formType, profile, dividend, signatureBytes });
  
  // Generate deterministic filename
  const sanitizedName = profile.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'User';
  const currentDate = new Date().toISOString().split('T')[0];
  const filename = `Form15${formType.toUpperCase()}_PartA_${profile.fy_label || 'FY'}_${sanitizedName}_${dividend.symbol}.pdf`;
  
  return { blob, formType, filename };
}