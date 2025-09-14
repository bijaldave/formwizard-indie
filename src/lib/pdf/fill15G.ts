import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { Profile, DividendRow } from '../../types';
import { detectAnchors } from './anchors';
import { solveAffineTransform, transformRectangle, AffineMatrix } from './affine';
import { CANONICAL_ANCHORS, FORM_15G_FIELDS, percentageToPoints, formatIndianNumber } from './fieldMaps';
import { templateManager } from './templateManager';
import { renderDebugOverlay } from './debug';

export interface Form15GData {
  name: string;
  pan: string;
  status_individual: boolean;
  status_huf: boolean;
  previous_year: string;
  residential_status: string;
  addr_flat: string;
  addr_premises: string;
  addr_street: string;
  addr_area: string;
  addr_city: string;
  addr_state: string;
  addr_pin: string;
  email: string;
  phone: string;
  assessed_yes: boolean;
  assessed_no: boolean;
  latest_ay: string;
  income_for_decl: string;
  income_total_fy: string;
  other_forms_count: string;
  other_forms_amount: string;
  boid: string;
  nature_income: string;
  section: string;
  dividend_amount: string;
  signature?: string; // base64 image
  place_date: string;
}

/**
 * Convert profile and dividend data to Form 15G format
 */
export function profileToForm15GData(profile: Profile, readyDividends: DividendRow[]): Form15GData {
  const totalDividend = readyDividends.reduce((sum, d) => sum + d.total, 0);
  const currentDate = new Date();
  
  return {
    name: profile.name,
    pan: profile.pan,
    status_individual: profile.status === 'Individual',
    status_huf: profile.status === 'HUF',
    previous_year: `${profile.fy_label} relevant to AY ${profile.latest_ay}`,
    residential_status: profile.residential_status === 'Indian' ? 'RESIDENT' : 'NON-RESIDENT',
    addr_flat: profile.addr_flat,
    addr_premises: profile.addr_premises,
    addr_street: profile.addr_street,
    addr_area: profile.addr_area,
    addr_city: profile.addr_city,
    addr_state: profile.addr_state,
    addr_pin: profile.addr_pin,
    email: profile.email,
    phone: profile.phone,
    assessed_yes: profile.assessed_to_tax === 'Yes',
    assessed_no: profile.assessed_to_tax === 'No',
    latest_ay: profile.latest_ay,
    income_for_decl: totalDividend.toFixed(2),
    income_total_fy: profile.income_total_fy.toFixed(2),
    other_forms_count: profile.other_forms_count.toString(),
    other_forms_amount: profile.other_forms_amount.toFixed(2),
    boid: profile.boid,
    nature_income: "Dividend",
    section: "194",
    dividend_amount: totalDividend.toFixed(2),
    signature: profile.signature,
    place_date: `Mumbai ${currentDate.toLocaleDateString('en-GB')}`
  };
}

/**
 * Fill Form 15G PDF with user data using anchor-based positioning
 */
export async function fillForm15G(
  templateFile: File, 
  data: Form15GData, 
  debugMode: boolean = false
): Promise<Uint8Array> {
  
  // Validate template
  const validation = await templateManager.validateTemplate(templateFile);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Calculate template hash for caching
  const hash = await templateManager.calculatePdfHash(templateFile);
  let cachedTemplate = templateManager.getCachedTemplate(hash);
  let affineMatrix: AffineMatrix;

  if (cachedTemplate?.affineMatrix) {
    // Use cached affine matrix
    affineMatrix = cachedTemplate.affineMatrix;
  } else {
    // Detect anchors and compute affine transformation
    const detectedAnchors = await detectAnchors(templateFile);
    
    if (detectedAnchors.length < 3) {
      throw new Error('Template text not detected. Please use the provided official template.');
    }

    // Map detected anchors to canonical anchors
    const canonicalPoints = [];
    const measuredPoints = [];
    
    for (const anchor of detectedAnchors) {
      const canonicalPoint = CANONICAL_ANCHORS[anchor.text];
      if (canonicalPoint) {
        canonicalPoints.push(canonicalPoint);
        measuredPoints.push({ x: anchor.x, y: anchor.y });
      }
    }

    if (canonicalPoints.length < 3) {
      throw new Error('Insufficient anchor matches. Please use the provided official template.');
    }

    // Solve affine transformation
    const { matrix, rmsError } = solveAffineTransform(canonicalPoints, measuredPoints);
    
    if (rmsError > 4) {
      throw new Error(`Template alignment error too high (${rmsError.toFixed(2)}pt). Enable debug mode for review.`);
    }

    affineMatrix = matrix;

    // Cache the results
    templateManager.cacheTemplate(hash, {
      hash,
      pageSize: { width: 595.32, height: 841.92 },
      detectedAnchors: detectedAnchors.reduce((acc, anchor) => {
        acc[anchor.text] = { x: anchor.x, y: anchor.y };
        return acc;
      }, {} as { [key: string]: { x: number; y: number } }),
      affineMatrix
    });
  }

  // Load template PDF
  const templateArrayBuffer = await templateFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateArrayBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Get font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Fill all fields
  await fillAllFields(firstPage, font, data, affineMatrix);

  // Add debug overlay if requested
  if (debugMode && cachedTemplate) {
    await renderDebugOverlay(
      firstPage, 
      font, 
      affineMatrix, 
      Object.values(cachedTemplate.detectedAnchors),
      Object.values(CANONICAL_ANCHORS)
    );
  }

  // Return PDF bytes
  return pdfDoc.save();
}

/**
 * Fill all form fields with transformed coordinates
 */
async function fillAllFields(
  page: PDFPage, 
  font: any, 
  data: Form15GData, 
  affineMatrix: AffineMatrix
): Promise<void> {
  
  // Helper function to draw text in a field
  const drawTextField = (fieldName: string, text: string, rightAlign: boolean = false) => {
    if (!text) return;
    
    const field = FORM_15G_FIELDS[fieldName];
    if (!field) return;
    
    const canonicalRect = percentageToPoints(field);
    const transformedRect = transformRectangle(affineMatrix, canonicalRect);
    
    // Auto-shrink font to fit
    let fontSize = 12;
    let textWidth = font.widthOfTextAtSize(text, fontSize);
    
    while (textWidth > transformedRect.width - 4 && fontSize > 8) {
      fontSize -= 0.5;
      textWidth = font.widthOfTextAtSize(text, fontSize);
    }
    
    // Calculate position (vertically centered)
    const x = rightAlign 
      ? transformedRect.x + transformedRect.width - textWidth - 2
      : transformedRect.x + 2;
    const y = transformedRect.y + (transformedRect.height - fontSize) / 2;
    
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    });
  };

  // Helper function to draw checkbox
  const drawCheckbox = (fieldName: string, checked: boolean) => {
    if (!checked) return;
    
    const field = FORM_15G_FIELDS[fieldName];
    if (!field) return;
    
    const canonicalRect = percentageToPoints(field);
    const transformedRect = transformRectangle(affineMatrix, canonicalRect);
    
    // Draw checkmark centered in box
    const checkSize = Math.min(transformedRect.width, transformedRect.height) * 0.7;
    const x = transformedRect.x + (transformedRect.width - checkSize) / 2;
    const y = transformedRect.y + (transformedRect.height - checkSize) / 2;
    
    page.drawText('✓', {
      x,
      y,
      size: checkSize,
      font,
      color: rgb(0, 0, 0)
    });
  };

  // Fill all text fields
  drawTextField('name', data.name);
  drawTextField('pan', data.pan);
  drawTextField('previous_year', data.previous_year);
  drawTextField('residential_status', data.residential_status);
  drawTextField('addr_flat', data.addr_flat);
  drawTextField('addr_premises', data.addr_premises);
  drawTextField('addr_street', data.addr_street);
  drawTextField('addr_area', data.addr_area);
  drawTextField('addr_city', data.addr_city);
  drawTextField('addr_state', data.addr_state);
  drawTextField('addr_pin', data.addr_pin);
  drawTextField('email', data.email);
  drawTextField('phone', data.phone);
  drawTextField('latest_ay', data.latest_ay);
  drawTextField('income_for_decl', formatIndianNumber(parseFloat(data.income_for_decl)), true);
  drawTextField('income_total_fy', formatIndianNumber(parseFloat(data.income_total_fy)), true);
  drawTextField('other_forms_count', data.other_forms_count);
  drawTextField('other_forms_amount', formatIndianNumber(parseFloat(data.other_forms_amount)), true);
  drawTextField('boid', data.boid);
  drawTextField('nature_income', data.nature_income);
  drawTextField('section', data.section);
  drawTextField('dividend_amount', formatIndianNumber(parseFloat(data.dividend_amount)), true);
  drawTextField('place_date', data.place_date);

  // Fill checkboxes
  drawCheckbox('status_individual_check', data.status_individual);
  drawCheckbox('status_huf_check', data.status_huf);
  drawCheckbox('assessed_yes_check', data.assessed_yes);
  drawCheckbox('assessed_no_check', data.assessed_no);

  // Handle signature if present
  if (data.signature) {
    try {
      // Convert base64 to image (assuming PNG)
      const imageBytes = Uint8Array.from(atob(data.signature.split(',')[1]), c => c.charCodeAt(0));
      const image = await page.doc.embedPng(imageBytes);
      
      const field = FORM_15G_FIELDS['signature'];
      const canonicalRect = percentageToPoints(field);
      const transformedRect = transformRectangle(affineMatrix, canonicalRect);
      
      // Scale image to fit with 2% padding, preserve aspect ratio
      const padding = 0.02;
      const availableWidth = transformedRect.width * (1 - 2 * padding);
      const availableHeight = transformedRect.height * (1 - 2 * padding);
      
      const imageAspect = image.width / image.height;
      const availableAspect = availableWidth / availableHeight;
      
      let drawWidth, drawHeight;
      if (imageAspect > availableAspect) {
        drawWidth = availableWidth;
        drawHeight = availableWidth / imageAspect;
      } else {
        drawHeight = availableHeight;
        drawWidth = availableHeight * imageAspect;
      }
      
      // Center the image
      const x = transformedRect.x + (transformedRect.width - drawWidth) / 2;
      const y = transformedRect.y + (transformedRect.height - drawHeight) / 2;
      
      page.drawImage(image, {
        x,
        y,
        width: drawWidth,
        height: drawHeight
      });
    } catch (error) {
      console.warn('Failed to embed signature:', error);
    }
  }
}