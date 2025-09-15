/**
 * Hardcoded pixel-perfect coordinate maps for PDF templates
 * These coordinates are manually measured and calibrated for the embedded templates
 */

export interface ManualInputBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ManualCoordinateMap {
  pageWidth: number;
  pageHeight: number;
  fields: { [key: string]: ManualInputBox };
}

/**
 * Manual coordinate map for 15G_UPDATED-5.pdf
 * Page dimensions: 595.28 x 841.89 (A4 portrait)
 */
export const MANUAL_15G_MAP: ManualCoordinateMap = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  fields: {
    // Personal details section
    name: { x: 150, y: 750, width: 300, height: 16 },
    pan: { x: 150, y: 725, width: 150, height: 16 },
    
    // Status checkboxes (approximate positions)
    status_individual: { x: 120, y: 700, width: 12, height: 12 },
    status_huf: { x: 200, y: 700, width: 12, height: 12 },
    
    // Years
    previous_year: { x: 150, y: 675, width: 80, height: 16 },
    assessment_year: { x: 350, y: 675, width: 80, height: 16 },
    
    // Address fields
    addr_flat: { x: 150, y: 650, width: 200, height: 16 },
    addr_premises: { x: 150, y: 625, width: 200, height: 16 },
    addr_street: { x: 150, y: 600, width: 200, height: 16 },
    addr_area: { x: 150, y: 575, width: 200, height: 16 },
    addr_city: { x: 150, y: 550, width: 120, height: 16 },
    addr_state: { x: 280, y: 550, width: 100, height: 16 },
    addr_pin: { x: 390, y: 550, width: 80, height: 16 },
    
    // Contact details
    email: { x: 150, y: 525, width: 200, height: 16 },
    phone: { x: 150, y: 500, width: 150, height: 16 },
    
    // Residential status
    residential_status: { x: 120, y: 475, width: 12, height: 12 },
    
    // Assessment details
    assessed_yes: { x: 120, y: 450, width: 12, height: 12 },
    assessed_no: { x: 180, y: 450, width: 12, height: 12 },
    latest_ay: { x: 300, y: 450, width: 80, height: 16 },
    
    // Income details
    estimated_income_current: { x: 150, y: 425, width: 120, height: 16 },
    estimated_income_total: { x: 350, y: 425, width: 120, height: 16 },
    
    // Demat and dividend details
    boid: { x: 150, y: 400, width: 150, height: 16 },
    nature_income: { x: 150, y: 375, width: 100, height: 16 },
    section: { x: 300, y: 375, width: 60, height: 16 },
    dividend_amount: { x: 150, y: 350, width: 120, height: 16 },
    
    // Form details
    form_count: { x: 150, y: 325, width: 60, height: 16 },
    form_amount: { x: 250, y: 325, width: 120, height: 16 },
    
    // Declaration details
    declaration_fy_end: { x: 150, y: 275, width: 80, height: 16 },
    declaration_ay: { x: 300, y: 275, width: 80, height: 16 },
    
    // Signature
    signature: { x: 400, y: 150, width: 120, height: 40 }
  }
};

/**
 * Manual coordinate map for Form_15H-3.pdf
 * Page dimensions: 595.28 x 841.89 (A4 portrait)
 */
export const MANUAL_15H_MAP: ManualCoordinateMap = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  fields: {
    // Personal details section
    name: { x: 150, y: 750, width: 300, height: 16 },
    pan: { x: 150, y: 725, width: 150, height: 16 },
    
    // Address (multi-line)
    address: { x: 150, y: 650, width: 300, height: 60 },
    
    // Years
    previous_year: { x: 150, y: 600, width: 80, height: 16 },
    assessment_year: { x: 350, y: 600, width: 80, height: 16 },
    
    // Residential status
    residential_status: { x: 120, y: 575, width: 12, height: 12 },
    
    // Assessment details
    assessed_yes: { x: 120, y: 550, width: 12, height: 12 },
    assessed_no: { x: 180, y: 550, width: 12, height: 12 },
    latest_ay: { x: 300, y: 550, width: 80, height: 16 },
    
    // Income details
    estimated_income_current: { x: 150, y: 525, width: 120, height: 16 },
    estimated_income_total: { x: 350, y: 525, width: 120, height: 16 },
    
    // Demat and dividend details
    boid: { x: 150, y: 500, width: 150, height: 16 },
    nature_income: { x: 150, y: 475, width: 100, height: 16 },
    section: { x: 300, y: 475, width: 60, height: 16 },
    dividend_amount: { x: 150, y: 450, width: 120, height: 16 },
    
    // Form details
    form_count: { x: 150, y: 425, width: 60, height: 16 },
    form_amount: { x: 250, y: 425, width: 120, height: 16 },
    
    // Declaration details
    declaration_fy_end: { x: 150, y: 375, width: 80, height: 16 },
    declaration_ay: { x: 300, y: 375, width: 80, height: 16 },
    
    // Signature
    signature: { x: 400, y: 250, width: 120, height: 40 }
  }
};

/**
 * Get manual coordinate map for a form type
 */
export function getManualCoordinateMap(formType: '15G' | '15H'): ManualCoordinateMap {
  return formType === '15G' ? MANUAL_15G_MAP : MANUAL_15H_MAP;
}

/**
 * Global position nudges for fine-tuning (can be adjusted easily)
 */
export const GLOBAL_NUDGES = {
  textOffsetX: 2,
  textOffsetY: 0,
  checkboxOffsetX: 0,
  checkboxOffsetY: 0,
  signatureOffsetX: 0,
  signatureOffsetY: 0
};