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
      // Personal Information
      { name: 'name', label: 'Name', x: 135, y: 95, width: 180, type: 'text' },
      { name: 'pan', label: 'PAN', x: 325, y: 95, width: 100, type: 'text' },
      { name: 'status_individual', label: 'Individual', x: 37, y: 113, width: 10, type: 'checkbox' },
      { name: 'status_huf', label: 'HUF', x: 90, y: 113, width: 10, type: 'checkbox' },
      
      // Previous Year & Residential Status
      { name: 'previous_year', label: 'Previous Year', x: 233, y: 113, width: 50, type: 'text' },
      { name: 'resident_indian', label: 'Indian Resident', x: 340, y: 113, width: 10, type: 'checkbox' },
      { name: 'resident_nri', label: 'NRI', x: 420, y: 113, width: 10, type: 'checkbox' },
      
      // Address Fields
      { name: 'addr_flat', label: 'Flat/Door No', x: 135, y: 135, width: 120, type: 'text' },
      { name: 'addr_premises', label: 'Name of Premises', x: 260, y: 135, width: 140, type: 'text' },
      { name: 'addr_street', label: 'Road/Street/Lane', x: 135, y: 155, width: 120, type: 'text' },
      { name: 'addr_area', label: 'Area/Locality', x: 260, y: 155, width: 140, type: 'text' },
      { name: 'addr_city', label: 'Town/City/District', x: 135, y: 175, width: 120, type: 'text' },
      { name: 'addr_state', label: 'State', x: 260, y: 175, width: 100, type: 'text' },
      { name: 'addr_pin', label: 'PIN Code', x: 365, y: 175, width: 70, type: 'text' },
      
      // Contact Information
      { name: 'email', label: 'Email', x: 135, y: 195, width: 150, type: 'text' },
      { name: 'phone', label: 'Mobile No', x: 300, y: 195, width: 100, type: 'text' },
      
      // Tax Assessment
      { name: 'assessed_yes', label: 'Assessed Yes', x: 350, y: 230, width: 10, type: 'checkbox' },
      { name: 'assessed_no', label: 'Assessed No', x: 380, y: 230, width: 10, type: 'checkbox' },
      { name: 'latest_ay', label: 'Latest AY', x: 135, y: 250, width: 80, type: 'text' },
      
      // Income Information
      { name: 'income_for_decl', label: 'Income for Declaration', x: 135, y: 285, width: 100, type: 'text' },
      { name: 'income_total_fy', label: 'Total Income FY', x: 300, y: 285, width: 100, type: 'text' },
      { name: 'other_forms_count', label: 'Other Forms Count', x: 135, y: 305, width: 80, type: 'text' },
      { name: 'other_forms_amount', label: 'Other Forms Amount', x: 300, y: 305, width: 100, type: 'text' },
      
      // Investment Table (5 columns)
      { name: 'incomeTbl_slno', label: 'Sl No', x: 40, y: 350, width: 30, type: 'table' },
      { name: 'incomeTbl_id', label: 'Investment ID', x: 75, y: 350, width: 120, type: 'table' },
      { name: 'incomeTbl_nature', label: 'Nature of Income', x: 200, y: 350, width: 100, type: 'table' },
      { name: 'incomeTbl_section', label: 'Tax Section', x: 305, y: 350, width: 60, type: 'table' },
      { name: 'incomeTbl_amount', label: 'Amount', x: 370, y: 350, width: 80, type: 'table' },
      
      // Signature
      { name: 'signature', label: 'Signature', x: 350, y: 450, width: 100, height: 40, type: 'text' }
    ];
  } else {
    // Form 15H patterns (similar structure but different coordinates)
    return [
      { name: 'name', label: 'Name', x: 135, y: 95, width: 180, type: 'text' },
      { name: 'pan', label: 'PAN', x: 325, y: 95, width: 100, type: 'text' },
      { name: 'dob', label: 'Date of Birth', x: 135, y: 115, width: 100, type: 'text' },
      { name: 'status_individual', label: 'Individual', x: 37, y: 135, width: 10, type: 'checkbox' },
      { name: 'status_huf', label: 'HUF', x: 90, y: 135, width: 10, type: 'checkbox' },
      
      // Address and other fields for 15H
      { name: 'addr_flat', label: 'Flat/Door No', x: 135, y: 155, width: 120, type: 'text' },
      { name: 'addr_premises', label: 'Name of Premises', x: 260, y: 155, width: 140, type: 'text' },
      { name: 'addr_street', label: 'Road/Street/Lane', x: 135, y: 175, width: 120, type: 'text' },
      { name: 'addr_area', label: 'Area/Locality', x: 260, y: 175, width: 140, type: 'text' },
      { name: 'addr_city', label: 'Town/City/District', x: 135, y: 195, width: 120, type: 'text' },
      { name: 'addr_state', label: 'State', x: 260, y: 195, width: 100, type: 'text' },
      { name: 'addr_pin', label: 'PIN Code', x: 365, y: 195, width: 70, type: 'text' },
      
      { name: 'email', label: 'Email', x: 135, y: 215, width: 150, type: 'text' },
      { name: 'phone', label: 'Mobile No', x: 300, y: 215, width: 100, type: 'text' },
      
      // Income and investment table similar to 15G but adjusted positions
      { name: 'income_for_decl', label: 'Income for Declaration', x: 135, y: 285, width: 100, type: 'text' },
      { name: 'income_total_fy', label: 'Total Income FY', x: 300, y: 285, width: 100, type: 'text' },
      
      { name: 'incomeTbl_slno', label: 'Sl No', x: 40, y: 350, width: 30, type: 'table' },
      { name: 'incomeTbl_id', label: 'Investment ID', x: 75, y: 350, width: 120, type: 'table' },
      { name: 'incomeTbl_nature', label: 'Nature of Income', x: 200, y: 350, width: 100, type: 'table' },
      { name: 'incomeTbl_section', label: 'Tax Section', x: 305, y: 350, width: 60, type: 'table' },
      { name: 'incomeTbl_amount', label: 'Amount', x: 370, y: 350, width: 80, type: 'table' },
      
      { name: 'signature', label: 'Signature', x: 350, y: 450, width: 100, height: 40, type: 'text' }
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
  // Fallback optimized coordinates when PDF reading fails
  const optimized15G = {
    // Personal Info - optimized font sizes
    name: { x: 135, y: 727, width: 180, height: 16, fontSize: 9, maxWidth: 178 },
    pan: { x: 325, y: 727, width: 100, height: 16, fontSize: 9, maxWidth: 98 },
    status_individual: { x: 37, y: 709, width: 10, height: 10, fontSize: 10 },
    status_huf: { x: 90, y: 709, width: 10, height: 10, fontSize: 10 },
    
    // Previous Year (small field - reduced font)
    previous_year: { x: 233, y: 709, width: 50, height: 16, fontSize: 7, maxWidth: 48 },
    resident_indian: { x: 340, y: 709, width: 10, height: 10, fontSize: 10 },
    resident_nri: { x: 420, y: 709, width: 10, height: 10, fontSize: 10 },
    
    // Address - consistent sizing
    addr_flat: { x: 135, y: 687, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
    addr_premises: { x: 260, y: 687, width: 140, height: 16, fontSize: 8, maxWidth: 138 },
    addr_street: { x: 135, y: 667, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
    addr_area: { x: 260, y: 667, width: 140, height: 16, fontSize: 8, maxWidth: 138 },
    addr_city: { x: 135, y: 647, width: 120, height: 16, fontSize: 8, maxWidth: 118 },
    addr_state: { x: 260, y: 647, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
    addr_pin: { x: 365, y: 647, width: 70, height: 16, fontSize: 8, maxWidth: 68 },
    
    // Contact
    email: { x: 135, y: 627, width: 150, height: 16, fontSize: 8, maxWidth: 148 },
    phone: { x: 300, y: 627, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
    
    // Tax Assessment
    assessed_yes: { x: 350, y: 592, width: 10, height: 10, fontSize: 10 },
    assessed_no: { x: 380, y: 592, width: 10, height: 10, fontSize: 10 },
    latest_ay: { x: 135, y: 572, width: 80, height: 16, fontSize: 8, maxWidth: 78 },
    
    // Income
    income_for_decl: { x: 135, y: 537, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
    income_total_fy: { x: 300, y: 537, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
    other_forms_count: { x: 135, y: 517, width: 80, height: 16, fontSize: 8, maxWidth: 78 },
    other_forms_amount: { x: 300, y: 517, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
    
    // Investment Table - corrected coordinates and smaller font
    incomeTbl_slno: { x: 40, y: 472, width: 30, height: 16, fontSize: 7, maxWidth: 28 },
    incomeTbl_id: { x: 75, y: 472, width: 120, height: 16, fontSize: 7, maxWidth: 118 },
    incomeTbl_nature: { x: 200, y: 472, width: 100, height: 16, fontSize: 7, maxWidth: 98 },
    incomeTbl_section: { x: 305, y: 472, width: 60, height: 16, fontSize: 7, maxWidth: 58 },
    incomeTbl_amount: { x: 370, y: 472, width: 80, height: 16, fontSize: 7, maxWidth: 78, align: 'right' },
    
    // Signature
    signature: { x: 350, y: 372, width: 100, height: 40, fontSize: 10, maxWidth: 98 }
  };

  const optimized15H = {
    // Similar structure to 15G but with Form 15H specific coordinates
    ...optimized15G,
    dob: { x: 135, y: 707, width: 100, height: 16, fontSize: 8, maxWidth: 98 },
    // Adjust other coordinates as needed for 15H
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