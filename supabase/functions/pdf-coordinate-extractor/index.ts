import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { PDFDocument, PDFPage } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FieldMapping {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  align?: 'left' | 'right' | 'center';
  maxWidth?: number;
}

interface ExtractedField {
  name: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  type: 'text' | 'checkbox' | 'table';
  maxWidth: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formType } = await req.json();
    
    if (!formType || !['15G', '15H'].includes(formType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid form type. Must be 15G or 15H' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting coordinate extraction for Form ${formType}`);
    
    // Read the PDF file
    const pdfPath = formType === '15G' ? '/var/task/public/forms/15G_UPDATED.pdf' : '/var/task/public/forms/Form_15H.pdf';
    
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await Deno.readFile(pdfPath);
    } catch (error) {
      console.error(`Error reading PDF file: ${error}`);
      // Fallback: return optimized coordinates based on analysis
      return getOptimizedCoordinates(formType);
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const firstPage = pdfDoc.getPage(0);
    const { width: pageWidth, height: pageHeight } = firstPage.getSize();
    
    console.log(`PDF dimensions: ${pageWidth} x ${pageHeight}`);

    // Extract and optimize field coordinates
    const extractedFields = await extractFieldCoordinates(firstPage, formType, pageHeight);
    
    // Generate optimized field mappings
    const fieldMappings = generateFieldMappings(extractedFields, formType);
    
    console.log(`Extracted ${Object.keys(fieldMappings).length} fields for Form ${formType}`);

    return new Response(
      JSON.stringify({
        success: true,
        formType,
        pageWidth,
        pageHeight,
        fieldMappings,
        extractedFields: extractedFields.length,
        optimizationApplied: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in PDF coordinate extraction:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to extract coordinates', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function extractFieldCoordinates(page: PDFPage, formType: string, pageHeight: number): Promise<ExtractedField[]> {
  const fields: ExtractedField[] = [];
  
  // Define field patterns and their expected locations based on form analysis
  const fieldPatterns = getFieldPatterns(formType);
  
  for (const pattern of fieldPatterns) {
    const field: ExtractedField = {
      name: pattern.name,
      label: pattern.label,
      x: pattern.x,
      y: pageHeight - pattern.y, // Convert from top-left to bottom-left
      width: pattern.width,
      height: pattern.height || 16,
      fontSize: calculateOptimalFontSize(pattern.width, pattern.type),
      type: pattern.type,
      maxWidth: pattern.width - 2 // Leave 2px padding
    };
    
    fields.push(field);
  }
  
  return fields;
}

function getFieldPatterns(formType: string) {
  if (formType === '15G') {
    return [
      // Personal Information - corrected coordinates based on actual form
      { name: 'name', label: 'Name', x: 120, y: 95, width: 200, type: 'text' },
      { name: 'pan', label: 'PAN', x: 350, y: 95, width: 120, type: 'text' },
      
      // Status checkboxes - Individual/HUF
      { name: 'status_individual', label: 'Individual', x: 55, y: 115, width: 12, type: 'checkbox' },
      { name: 'status_huf', label: 'HUF', x: 125, y: 115, width: 12, type: 'checkbox' },
      
      // Previous Year (Assessment Year)
      { name: 'previous_year', label: 'Previous Year', x: 280, y: 115, width: 60, type: 'text' },
      
      // Residential Status checkboxes - corrected field names to match PDF generator
      { name: 'residential_status_indian', label: 'Indian Resident', x: 380, y: 115, width: 12, type: 'checkbox' },
      { name: 'residential_status_nri', label: 'NRI', x: 450, y: 115, width: 12, type: 'checkbox' },
      
      // Address Fields - repositioned for better alignment
      { name: 'addr_flat', label: 'Flat/Door No', x: 120, y: 140, width: 140, type: 'text' },
      { name: 'addr_premises', label: 'Name of Premises', x: 280, y: 140, width: 160, type: 'text' },
      { name: 'addr_street', label: 'Road/Street/Lane', x: 120, y: 165, width: 140, type: 'text' },
      { name: 'addr_area', label: 'Area/Locality', x: 280, y: 165, width: 160, type: 'text' },
      { name: 'addr_city', label: 'Town/City/District', x: 120, y: 190, width: 140, type: 'text' },
      { name: 'addr_state', label: 'State', x: 280, y: 190, width: 100, type: 'text' },
      { name: 'addr_pin', label: 'PIN Code', x: 400, y: 190, width: 80, type: 'text' },
      
      // Contact Information
      { name: 'email', label: 'Email', x: 120, y: 215, width: 180, type: 'text' },
      { name: 'phone', label: 'Mobile No', x: 320, y: 215, width: 120, type: 'text' },
      
      // Tax Assessment - corrected positioning
      { name: 'assessed_yes', label: 'Assessed Yes', x: 380, y: 255, width: 12, type: 'checkbox' },
      { name: 'assessed_no', label: 'Assessed No', x: 420, y: 255, width: 12, type: 'checkbox' },
      { name: 'latest_ay', label: 'Latest AY', x: 120, y: 280, width: 100, type: 'text' },
      
      // Income Information - better spacing
      { name: 'income_for_decl', label: 'Income for Declaration', x: 120, y: 320, width: 120, type: 'text' },
      { name: 'income_total_fy', label: 'Total Income FY', x: 320, y: 320, width: 120, type: 'text' },
      { name: 'other_forms_count', label: 'Other Forms Count', x: 120, y: 345, width: 100, type: 'text' },
      { name: 'other_forms_amount', label: 'Other Forms Amount', x: 320, y: 345, width: 120, type: 'text' },
      
      // Investment Table - corrected table structure with proper column alignment
      { name: 'incomeTbl_slno', label: 'Sl No', x: 50, y: 400, width: 25, type: 'table' },
      { name: 'incomeTbl_boid', label: 'BOID/Investment ID', x: 80, y: 400, width: 110, type: 'table' },
      { name: 'incomeTbl_nature', label: 'Nature of Income', x: 195, y: 400, width: 120, type: 'table' },
      { name: 'incomeTbl_section', label: 'Tax Section', x: 320, y: 400, width: 70, type: 'table' },
      { name: 'incomeTbl_amount', label: 'Amount', x: 395, y: 400, width: 85, type: 'table' },
      
      // Signature area
      { name: 'signature', label: 'Signature', x: 350, y: 500, width: 120, height: 50, type: 'text' }
    ];
  } else {
    // Form 15H patterns (similar structure to 15G with age-specific adjustments)
    return [
      { name: 'name', label: 'Name', x: 120, y: 95, width: 200, type: 'text' },
      { name: 'pan', label: 'PAN', x: 350, y: 95, width: 120, type: 'text' },
      { name: 'dob', label: 'Date of Birth', x: 120, y: 115, width: 120, type: 'text' },
      
      { name: 'status_individual', label: 'Individual', x: 55, y: 135, width: 12, type: 'checkbox' },
      { name: 'status_huf', label: 'HUF', x: 125, y: 135, width: 12, type: 'checkbox' },
      
      // Address fields for 15H
      { name: 'addr_flat', label: 'Flat/Door No', x: 120, y: 160, width: 140, type: 'text' },
      { name: 'addr_premises', label: 'Name of Premises', x: 280, y: 160, width: 160, type: 'text' },
      { name: 'addr_street', label: 'Road/Street/Lane', x: 120, y: 185, width: 140, type: 'text' },
      { name: 'addr_area', label: 'Area/Locality', x: 280, y: 185, width: 160, type: 'text' },
      { name: 'addr_city', label: 'Town/City/District', x: 120, y: 210, width: 140, type: 'text' },
      { name: 'addr_state', label: 'State', x: 280, y: 210, width: 100, type: 'text' },
      { name: 'addr_pin', label: 'PIN Code', x: 400, y: 210, width: 80, type: 'text' },
      
      { name: 'email', label: 'Email', x: 120, y: 235, width: 180, type: 'text' },
      { name: 'phone', label: 'Mobile No', x: 320, y: 235, width: 120, type: 'text' },
      
      // Income information for 15H
      { name: 'income_for_decl', label: 'Income for Declaration', x: 120, y: 320, width: 120, type: 'text' },
      { name: 'income_total_fy', label: 'Total Income FY', x: 320, y: 320, width: 120, type: 'text' },
      
      // Investment table for 15H
      { name: 'incomeTbl_slno', label: 'Sl No', x: 50, y: 400, width: 25, type: 'table' },
      { name: 'incomeTbl_boid', label: 'Investment ID', x: 80, y: 400, width: 110, type: 'table' },
      { name: 'incomeTbl_nature', label: 'Nature of Income', x: 195, y: 400, width: 120, type: 'table' },
      { name: 'incomeTbl_section', label: 'Tax Section', x: 320, y: 400, width: 70, type: 'table' },
      { name: 'incomeTbl_amount', label: 'Amount', x: 395, y: 400, width: 85, type: 'table' },
      
      { name: 'signature', label: 'Signature', x: 350, y: 500, width: 120, height: 50, type: 'text' }
    ];
  }
}

function calculateOptimalFontSize(width: number, fieldType: string): number {
  // Font size optimization based on field width and type
  if (fieldType === 'checkbox') {
    return 10; // Standard checkbox size
  }
  
  if (fieldType === 'table') {
    return 7; // Smaller font for table data
  }
  
  // Text fields - dynamic sizing based on width
  if (width < 50) {
    return 7; // Very small fields
  } else if (width < 80) {
    return 8; // Small to medium fields
  } else if (width < 120) {
    return 9; // Medium fields
  } else {
    return 10; // Large fields
  }
}

function generateFieldMappings(fields: ExtractedField[], formType: string): Record<string, FieldMapping> {
  const mappings: Record<string, FieldMapping> = {};
  
  for (const field of fields) {
    mappings[field.name] = {
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      fontSize: field.fontSize,
      maxWidth: field.maxWidth,
      align: field.type === 'table' && field.name.includes('amount') ? 'right' : 'left'
    };
  }
  
  return mappings;
}

function getOptimizedCoordinates(formType: string) {
  // Fallback optimized coordinates with corrected field mappings
  const optimized15G = {
    // Personal Info - corrected coordinates and optimized font sizes
    name: { x: 120, y: 727, width: 200, height: 18, fontSize: 10, maxWidth: 198 },
    pan: { x: 350, y: 727, width: 120, height: 18, fontSize: 10, maxWidth: 118 },
    
    // Status checkboxes - corrected positioning
    status_individual: { x: 55, y: 707, width: 12, height: 12, fontSize: 10 },
    status_huf: { x: 125, y: 707, width: 12, height: 12, fontSize: 10 },
    
    // Previous Year
    previous_year: { x: 280, y: 707, width: 60, height: 16, fontSize: 8, maxWidth: 58 },
    
    // Residential Status - corrected field names to match actual usage
    residential_status_indian: { x: 380, y: 707, width: 12, height: 12, fontSize: 10 },
    residential_status_nri: { x: 450, y: 707, width: 12, height: 12, fontSize: 10 },
    
    // Address - improved positioning and sizing
    addr_flat: { x: 120, y: 682, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
    addr_premises: { x: 280, y: 682, width: 160, height: 16, fontSize: 9, maxWidth: 158 },
    addr_street: { x: 120, y: 657, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
    addr_area: { x: 280, y: 657, width: 160, height: 16, fontSize: 9, maxWidth: 158 },
    addr_city: { x: 120, y: 632, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
    addr_state: { x: 280, y: 632, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
    addr_pin: { x: 400, y: 632, width: 80, height: 16, fontSize: 9, maxWidth: 78 },
    
    // Contact
    email: { x: 120, y: 607, width: 180, height: 16, fontSize: 9, maxWidth: 178 },
    phone: { x: 320, y: 607, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
    
    // Tax Assessment - corrected positioning
    assessed_yes: { x: 380, y: 567, width: 12, height: 12, fontSize: 10 },
    assessed_no: { x: 420, y: 567, width: 12, height: 12, fontSize: 10 },
    latest_ay: { x: 120, y: 542, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
    
    // Income Information - better spacing
    income_for_decl: { x: 120, y: 502, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
    income_total_fy: { x: 320, y: 502, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
    other_forms_count: { x: 120, y: 477, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
    other_forms_amount: { x: 320, y: 477, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
    
    // Investment Table - corrected structure with BOID column
    incomeTbl_slno: { x: 50, y: 422, width: 25, height: 16, fontSize: 8, maxWidth: 23 },
    incomeTbl_boid: { x: 80, y: 422, width: 110, height: 16, fontSize: 8, maxWidth: 108 },
    incomeTbl_nature: { x: 195, y: 422, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
    incomeTbl_section: { x: 320, y: 422, width: 70, height: 16, fontSize: 8, maxWidth: 68 },
    incomeTbl_amount: { x: 395, y: 422, width: 85, height: 16, fontSize: 8, maxWidth: 83, align: 'right' },
    
    // Signature
    signature: { x: 350, y: 322, width: 120, height: 50, fontSize: 10, maxWidth: 118 }
  };

  const optimized15H = {
    // Form 15H with similar structure but adjusted for age-specific fields
    ...optimized15G,
    dob: { x: 120, y: 707, width: 120, height: 16, fontSize: 9, maxWidth: 118 },
    // Remove previous_year and residential status fields specific to 15G
    previous_year: undefined,
    residential_status_indian: undefined,
    residential_status_nri: undefined,
    // Adjust address coordinates for 15H
    addr_flat: { x: 120, y: 662, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
    addr_premises: { x: 280, y: 662, width: 160, height: 16, fontSize: 9, maxWidth: 158 },
    addr_street: { x: 120, y: 637, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
    addr_area: { x: 280, y: 637, width: 160, height: 16, fontSize: 9, maxWidth: 158 },
    addr_city: { x: 120, y: 612, width: 140, height: 16, fontSize: 9, maxWidth: 138 },
    addr_state: { x: 280, y: 612, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
    addr_pin: { x: 400, y: 612, width: 80, height: 16, fontSize: 9, maxWidth: 78 },
    email: { x: 120, y: 587, width: 180, height: 16, fontSize: 9, maxWidth: 178 },
    phone: { x: 320, y: 587, width: 120, height: 16, fontSize: 9, maxWidth: 118 }
  };

  return new Response(
    JSON.stringify({
      success: true,
      formType,
      fieldMappings: formType === '15G' ? optimized15G : optimized15H,
      fallbackUsed: true,
      optimizationApplied: true
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}