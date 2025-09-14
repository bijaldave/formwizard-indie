import pdfjsLib from './pdfjsSetup';
import CryptoJS from 'crypto-js';

export interface TextRun {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelAnchor {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface InputBox {
  x: number;
  y: number;
  width: number;
  height: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

export interface CoordinateMap {
  pdfHash: string;
  pageWidth: number;
  pageHeight: number;
  fields: { [fieldKey: string]: InputBox };
  anchors: { [labelKey: string]: LabelAnchor };
  lastDetected: number;
}

// Form 15G Labels - comprehensive variations for reliable detection
const FORM_15G_LABELS = {
  name: ['Name of the Assessee', 'Name', 'Name of Assessee', 'Assessee Name', 'Full Name'],
  pan: ['PAN', 'Permanent Account Number', 'PAN No', 'PAN Number', 'P.A.N.'],
  status_individual: ['Individual', 'Status Individual', 'Individual Status', 'Ind.', 'Individual ✓'],
  status_huf: ['HUF', 'Hindu Undivided Family', 'Status HUF', 'H.U.F.', 'HUF ✓'],
  previous_year: ['Previous Year', 'Assessment Year', 'P.Y.', 'AY', 'Prev. Year', 'Financial Year'],
  assessment_year: ['Assessment Year', 'A.Y.', 'Year of Assessment', 'Assess. Year'],
  addr_flat: ['Flat', 'Flat No', 'Flat Number', 'House No', 'Flat/House No.', 'Dwelling No.'],
  addr_premises: ['Premises', 'Building', 'Premises Name', 'Building Name', 'Name of Premises'],
  addr_street: ['Street', 'Road', 'Street Name', 'Road/Street', 'Street/Road'],
  addr_area: ['Area', 'Locality', 'Area/Locality', 'Locality/Area'],
  addr_city: ['City', 'Town', 'City/Town', 'Town/City'],
  addr_state: ['State', 'State Name', 'State/UT'],
  addr_pin: ['PIN', 'Pincode', 'PIN Code', 'Postal Code', 'Pin Code', 'ZIP'],
  email: ['Email', 'E-mail', 'Email ID', 'Email Address', 'E-mail ID'],
  phone: ['Phone', 'Mobile', 'Phone No', 'Mobile No', 'Contact', 'Phone Number', 'Mobile Number'],
  residential_status: ['Residential Status', 'Status', 'Resident Status', 'Res. Status'],
  assessed_yes: ['Yes', 'Assessed - Yes', 'Yes ✓', 'Assessed Yes'],
  assessed_no: ['No', 'Assessed - No', 'No ✓', 'Assessed No'],
  latest_ay: ['Latest Assessment Year', 'Latest AY', 'Last AY', 'Previous Assessment Year'],
  estimated_income_current: ['Estimated Income', 'Current Income', 'Income Current', 'Current Year Income'],
  estimated_income_total: ['Total Income', 'Estimated Total', 'Total Estimated', 'Total Income Estimated'],
  boid: ['Identification Number', 'ID Number', 'BOID', 'Beneficiary ID', 'Identification No.'],
  nature_income: ['Nature of Income', 'Income Nature', 'Type of Income', 'Income Type'],
  section: ['Section', 'Section No', 'Under Section', 'Sec.', 'Section Number'],
  dividend_amount: ['Amount of Income', 'Income Amount', 'Dividend Amount', 'Amount'],
  form_count: ['Number of Forms', 'Total Forms', 'Forms Count', 'No. of Forms'],
  form_amount: ['Aggregate Amount', 'Total Amount', 'Amount Total', 'Aggregate Sum'],
  signature: ['Signature', 'Sign', 'Signature of Assessee', 'Assessee Signature'],
  declaration_fy_end: ['Financial Year', 'FY End', 'Year End', 'F.Y. End'],
  declaration_ay: ['Assessment Year', 'AY', 'Declaration AY', 'A.Y.']
};

// Form 15H Labels - comprehensive variations for reliable detection
const FORM_15H_LABELS = {
  name: ['Name of the Assessee', 'Name', 'Name of Assessee', 'Assessee Name', 'Full Name'],
  pan: ['PAN', 'Permanent Account Number', 'PAN No', 'PAN Number', 'P.A.N.'],
  address: ['Address', 'Full Address', 'Complete Address', 'Postal Address'],
  previous_year: ['Previous Year', 'P.Y.', 'Assessment Year', 'Prev. Year', 'Financial Year'],
  assessment_year: ['Assessment Year', 'A.Y.', 'Year of Assessment', 'Assess. Year'],
  residential_status: ['Residential Status', 'Status', 'Resident Status', 'Res. Status'],
  assessed_yes: ['Yes', 'Assessed - Yes', 'Yes ✓', 'Assessed Yes'],
  assessed_no: ['No', 'Assessed - No', 'No ✓', 'Assessed No'],
  latest_ay: ['Latest Assessment Year', 'Latest AY', 'Last AY', 'Previous Assessment Year'],
  estimated_income_current: ['Estimated Income', 'Current Income', 'Income Current', 'Current Year Income'],
  estimated_income_total: ['Total Income', 'Estimated Total', 'Total Estimated', 'Total Income Estimated'],
  boid: ['Identification Number', 'ID Number', 'BOID', 'Beneficiary ID', 'Identification No.'],
  nature_income: ['Nature of Income', 'Income Nature', 'Type of Income', 'Income Type'],
  section: ['Section', 'Section No', 'Under Section', 'Sec.', 'Section Number'],
  dividend_amount: ['Amount of Income', 'Income Amount', 'Dividend Amount', 'Amount'],
  form_count: ['Number of Forms', 'Total Forms', 'Forms Count', 'No. of Forms'],
  form_amount: ['Aggregate Amount', 'Total Amount', 'Amount Total', 'Aggregate Sum'],
  signature: ['Signature', 'Sign', 'Signature of Assessee', 'Assessee Signature'],
  declaration_fy_end: ['Financial Year', 'FY End', 'Year End', 'F.Y. End'],
  declaration_ay: ['Assessment Year', 'AY', 'Declaration AY', 'A.Y.']
};

/**
 * Calculate SHA-256 hash for PDF file
 */
export async function calculatePdfHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
  return CryptoJS.SHA256(wordArray).toString();
}

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return (maxLength - distance) / maxLength;
}

/**
 * Extract text runs from PDF page
 */
async function extractTextRuns(file: File): Promise<{ textRuns: TextRun[], pageWidth: number, pageHeight: number }> {
  try {
    console.log('COORD: Starting PDF text extraction...');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    if (!pdf || pdf.numPages === 0) {
      throw new Error('PDF document is empty or invalid');
    }
    
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    
    const textContent = await page.getTextContent();
    
    if (!textContent.items || textContent.items.length === 0) {
      console.log('COORD: WARNING - No text items found in PDF - may be image-based');
      throw new Error('No text content detected in PDF template');
    }

    console.log(`COORD: Page dimensions: ${viewport.width} x ${viewport.height}`);
    console.log(`COORD: Found ${textContent.items.length} text items`);
    
    const textRuns: TextRun[] = [];

    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        const transform = item.transform;
        const x = transform[4];
        // Fix Y coordinate calculation - use bottom-left origin consistently
        const y = viewport.height - transform[5];
        const width = item.width;
        const height = item.height;
        
        textRuns.push({
          text: item.str.trim(),
          x, y, width, height
        });
      }
    }

    console.log(`COORD: Extracted ${textRuns.length} text runs from PDF`);
    return {
      textRuns,
      pageWidth: viewport.width,
      pageHeight: viewport.height
    };
  } catch (error) {
    console.error('COORD ERROR: Failed to extract text from PDF:', error);
    throw new Error(`Template text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Group nearby text runs into phrases
 */
function groupTextRunsIntoSpansAndPhrases(textRuns: TextRun[]): Array<{ text: string, x: number, y: number, width: number, height: number }> {
  const phrases: Array<{ text: string, x: number, y: number, width: number, height: number }> = [];
  const used = new Set<number>();

  for (let i = 0; i < textRuns.length; i++) {
    if (used.has(i)) continue;

    let phrase = textRuns[i].text;
    let minX = textRuns[i].x;
    let maxX = textRuns[i].x + textRuns[i].width;
    let minY = textRuns[i].y;
    let maxY = textRuns[i].y + textRuns[i].height;
    
    used.add(i);

    // Look for adjacent text runs
    for (let j = i + 1; j < textRuns.length; j++) {
      if (used.has(j)) continue;

      const horizontalDistance = Math.abs(textRuns[j].x - maxX);
      const verticalDistance = Math.abs(textRuns[j].y - textRuns[i].y);
      
      // Adjacent if within 20pt horizontally and 5pt vertically
      if (horizontalDistance < 20 && verticalDistance < 5) {
        phrase += ' ' + textRuns[j].text;
        minX = Math.min(minX, textRuns[j].x);
        maxX = Math.max(maxX, textRuns[j].x + textRuns[j].width);
        minY = Math.min(minY, textRuns[j].y);
        maxY = Math.max(maxY, textRuns[j].y + textRuns[j].height);
        used.add(j);
      }
    }
    
    phrases.push({
      text: phrase,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    });
  }

  return phrases;
}

/**
 * Detect label anchors in PDF
 */
function detectLabelAnchors(
  phrases: Array<{ text: string, x: number, y: number, width: number, height: number }>,
  formType: '15G' | '15H'
): { [labelKey: string]: LabelAnchor } {
  const labelMap = formType === '15G' ? FORM_15G_LABELS : FORM_15H_LABELS;
  const anchors: { [labelKey: string]: LabelAnchor } = {};

  console.log(`COORD: Detecting anchors for Form ${formType} with ${Object.keys(labelMap).length} expected labels`);

  for (const [fieldKey, labelVariants] of Object.entries(labelMap)) {
    let bestMatch: { phrase: any; confidence: number } | null = null;

    for (const phrase of phrases) {
      const normalizedPhrase = normalizeText(phrase.text);
      
      for (const labelVariant of labelVariants) {
        const normalizedLabel = normalizeText(labelVariant);
        const confidence = calculateSimilarity(normalizedPhrase, normalizedLabel);
        const labelTokens = new Set(normalizedLabel.split(' '));
        const phraseTokens = new Set(normalizedPhrase.split(' '));
        const intersection = [...labelTokens].filter(t => phraseTokens.has(t));
        const tokenOverlap = intersection.length / Math.max(1, labelTokens.size);

        if ((confidence >= 0.6 || tokenOverlap >= 0.6) && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = { phrase, confidence };
        }
      }
    }

    if (bestMatch) {
      anchors[fieldKey] = {
        text: bestMatch.phrase.text,
        x: bestMatch.phrase.x,
        y: bestMatch.phrase.y,
        width: bestMatch.phrase.width,
        height: bestMatch.phrase.height,
        confidence: bestMatch.confidence
      };
      console.log(`COORD: Found anchor for '${fieldKey}': "${bestMatch.phrase.text}" (confidence: ${bestMatch.confidence.toFixed(2)})`);
    } else {
      console.warn(`COORD: No anchor found for field '${fieldKey}'`);
    }
  }

  console.log(`COORD: Successfully detected ${Object.keys(anchors).length}/${Object.keys(labelMap).length} anchors`);
  return anchors;
}

/**
 * Discover input boxes near label anchors
 */
function discoverInputBoxes(
  anchors: { [labelKey: string]: LabelAnchor },
  pageWidth: number,
  pageHeight: number
): { [fieldKey: string]: InputBox } {
  const inputBoxes: { [fieldKey: string]: InputBox } = {};

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  for (const [fieldKey, anchor] of Object.entries(anchors)) {
    let inputBox: InputBox;

    switch (fieldKey) {
      case 'signature': {
        const x = clamp(anchor.x, 10, pageWidth - 210);
        const y = clamp(anchor.y - 60, 10, pageHeight - 60);
        inputBox = {
          x,
          y,
          width: 200,
          height: 50,
          xPct: x / pageWidth,
          yPct: y / pageHeight,
          wPct: 200 / pageWidth,
          hPct: 50 / pageHeight
        };
        break;
      }

      case 'assessed_yes':
      case 'assessed_no': {
        const baseX = anchor.x + anchor.width + 10;
        const offset = fieldKey === 'assessed_no' ? 60 : 0;
        const xRaw = baseX + offset;
        const x = clamp(xRaw, 10, pageWidth - 12 - 10);
        const y = clamp(anchor.y, 10, pageHeight - 12 - 10);
        inputBox = {
          x,
          y,
          width: 12,
          height: 12,
          xPct: x / pageWidth,
          yPct: y / pageHeight,
          wPct: 12 / pageWidth,
          hPct: 12 / pageHeight
        };
        break;
      }

      case 'address': {
        const x = clamp(anchor.x, 10, pageWidth - 400 - 10);
        const y = clamp(anchor.y - 40, 10, pageHeight - 60 - 10);
        inputBox = {
          x,
          y,
          width: 400,
          height: 60,
          xPct: x / pageWidth,
          yPct: y / pageHeight,
          wPct: 400 / pageWidth,
          hPct: 60 / pageHeight
        };
        break;
      }

      default: {
        // Try right of label first
        let xRight = anchor.x + anchor.width + 10;
        let maxRightWidth = pageWidth - xRight - 10;
        let width = clamp(150, 40, maxRightWidth);

        // If not enough space, place to the left of the label
        if (maxRightWidth < 60) {
          width = 150;
          xRight = clamp(anchor.x - width - 10, 10, pageWidth - width - 10);
        }

        const x = clamp(xRight, 10, pageWidth - width - 10);
        const y = clamp(anchor.y, 10, pageHeight - 20 - 10);

        inputBox = {
          x,
          y,
          width,
          height: 20,
          xPct: x / pageWidth,
          yPct: y / pageHeight,
          wPct: width / pageWidth,
          hPct: 20 / pageHeight
        };
        break;
      }
    }

    inputBoxes[fieldKey] = inputBox;
  }

  console.log(`COORD: Anchors found: ${Object.keys(anchors).length} of expected, Fields discovered: ${Object.keys(inputBoxes).length}`);
  return inputBoxes;
}

/**
 * Main coordinate detection function
 */
export async function detectCoordinates(file: File, formType: '15G' | '15H'): Promise<CoordinateMap> {
  console.log(`COORD: Starting coordinate detection for Form ${formType}`);
  
  const pdfHash = await calculatePdfHash(file);
  console.log(`COORD: PDF hash: ${pdfHash.substring(0, 16)}...`);
  
  const { textRuns, pageWidth, pageHeight } = await extractTextRuns(file);
  
  // Group text runs into phrases
  const phrases = groupTextRunsIntoSpansAndPhrases(textRuns);
  console.log(`COORD: Grouped into ${phrases.length} phrases`);
  
  // Detect label anchors
  const anchors = detectLabelAnchors(phrases, formType);
  
  // Discover input boxes near anchors
  const fields = discoverInputBoxes(anchors, pageWidth, pageHeight);
  console.log(`COORD: Discovered ${Object.keys(fields).length} input boxes`);

  const coordinateMap = {
    pdfHash,
    pageWidth,
    pageHeight,
    fields,
    anchors,
    lastDetected: Date.now()
  };

  console.log(`COORD: Detected coordinates for Form ${formType}: ${Object.keys(anchors).length} anchors, ${Object.keys(fields).length} fields`);
  return coordinateMap;
}

/**
 * Validate anchors against cached coordinates
 */
export async function validateAnchors(
  file: File, 
  cachedCoords: CoordinateMap,
  formType: '15G' | '15H'
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    const { textRuns, pageWidth, pageHeight } = await extractTextRuns(file);
    const phrases = groupTextRunsIntoSpansAndPhrases(textRuns);
    const currentAnchors = detectLabelAnchors(phrases, formType);

    // Check each cached anchor
    for (const [fieldKey, cachedAnchor] of Object.entries(cachedCoords.anchors)) {
      const currentAnchor = currentAnchors[fieldKey];
      
      if (!currentAnchor) {
        errors.push(`Label for field '${fieldKey}' not found`);
        continue;
      }

      // Check if anchor moved more than 5pt
      const deltaX = Math.abs(currentAnchor.x - cachedAnchor.x);
      const deltaY = Math.abs(currentAnchor.y - cachedAnchor.y);
      
      if (deltaX > 5 || deltaY > 5) {
        errors.push(`Label for field '${fieldKey}' moved by ${deltaX.toFixed(1)}pt, ${deltaY.toFixed(1)}pt`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}