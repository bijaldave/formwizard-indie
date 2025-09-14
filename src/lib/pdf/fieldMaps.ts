import { Point, Rectangle } from './affine';

// Canonical page size for Form 15G (A4 in points)
export const CANONICAL_PAGE_SIZE = {
  width: 595.32,
  height: 841.92
};

// Canonical anchor positions (measured on reference template, bottom-left origin)
export const CANONICAL_ANCHORS: { [key: string]: Point } = {
  "name of assessee": { x: 120.5, y: 750.2 },
  "pan of the assessee": { x: 450.8, y: 750.2 }, 
  "signature of the declarant": { x: 150.3, y: 180.5 }
};

// Form 15G field definitions (bottom-left origin, percentage-based)
export const FORM_15G_FIELDS: { [key: string]: Rectangle } = {
  // Personal Information Section
  name: { x: 8.5, y: 82.0, width: 40.0, height: 4.5 },
  pan: { x: 52.0, y: 82.0, width: 40.0, height: 4.5 },
  
  // Status checkboxes
  status_individual_check: { x: 8.0, y: 77.5, width: 3.0, height: 3.0 },
  status_huf_check: { x: 15.0, y: 77.5, width: 3.0, height: 3.0 },
  
  // Previous year and residential status
  previous_year: { x: 25.0, y: 77.5, width: 22.0, height: 4.5 },
  residential_status: { x: 70.0, y: 77.5, width: 22.0, height: 4.5 },
  
  // Address fields (multiple rows)  
  addr_flat: { x: 8.5, y: 72.0, width: 18.0, height: 4.5 },
  addr_premises: { x: 28.0, y: 72.0, width: 20.0, height: 4.5 },
  addr_street: { x: 50.0, y: 72.0, width: 20.0, height: 4.5 },
  addr_area: { x: 72.0, y: 72.0, width: 20.0, height: 4.5 },
  addr_city: { x: 8.5, y: 67.0, width: 20.0, height: 4.5 },
  addr_state: { x: 30.0, y: 67.0, width: 15.0, height: 4.5 },
  addr_pin: { x: 47.0, y: 67.0, width: 12.0, height: 4.5 },
  email: { x: 61.0, y: 67.0, width: 31.0, height: 4.5 },
  phone: { x: 8.5, y: 62.0, width: 25.0, height: 4.5 },
  
  // Assessment information
  assessed_yes_check: { x: 60.0, y: 57.0, width: 3.0, height: 3.0 },
  assessed_no_check: { x: 70.0, y: 57.0, width: 3.0, height: 3.0 },
  latest_ay: { x: 35.0, y: 52.0, width: 25.0, height: 4.5 },
  
  // Income information
  income_for_decl: { x: 8.5, y: 47.0, width: 25.0, height: 4.5 },
  income_total_fy: { x: 35.0, y: 47.0, width: 25.0, height: 4.5 },
  
  // Other forms filed
  other_forms_count: { x: 8.5, y: 42.0, width: 15.0, height: 4.5 },
  other_forms_amount: { x: 55.0, y: 42.0, width: 35.0, height: 4.5 },
  
  // Dividend details table
  boid: { x: 8.5, y: 35.0, width: 30.0, height: 4.5 },
  nature_income: { x: 40.0, y: 35.0, width: 20.0, height: 4.5 },
  section: { x: 62.0, y: 35.0, width: 12.0, height: 4.5 },
  dividend_amount: { x: 76.0, y: 35.0, width: 16.0, height: 4.5 },
  
  // Signature area
  signature: { x: 8.5, y: 15.0, width: 35.0, height: 12.0 },
  place_date: { x: 55.0, y: 20.0, width: 35.0, height: 4.5 }
};

/**
 * Convert percentage-based coordinates to absolute points
 */
export function percentageToPoints(rect: Rectangle): Rectangle {
  return {
    x: (rect.x / 100) * CANONICAL_PAGE_SIZE.width,
    y: (rect.y / 100) * CANONICAL_PAGE_SIZE.height,
    width: (rect.width / 100) * CANONICAL_PAGE_SIZE.width,
    height: (rect.height / 100) * CANONICAL_PAGE_SIZE.height
  };
}

/**
 * Format number with Indian comma system
 */
export function formatIndianNumber(num: number): string {
  const [integer, decimal] = num.toFixed(2).split('.');
  
  // Add commas in Indian system (first comma after 3 digits from right, then every 2 digits)
  let formatted = '';
  const reversed = integer.split('').reverse();
  
  for (let i = 0; i < reversed.length; i++) {
    if (i === 3 || (i > 3 && (i - 3) % 2 === 0)) {
      formatted = ',' + formatted;
    }
    formatted = reversed[i] + formatted;
  }
  
  return `₹${formatted}.${decimal}`;
}
