import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

export interface AnchorPoint {
  text: string;
  x: number;
  y: number;
  confidence: number;
}

export interface TextRun {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Form 15G anchor set for detection
const FORM_15G_ANCHORS = [
  "name of assessee",
  "pan of the assessee", 
  "signature of the declarant"
];

/**
 * Levenshtein distance for fuzzy text matching
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
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return (maxLength - distance) / maxLength;
}

/**
 * Normalize text for matching (lowercase, collapse spaces, remove punctuation)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text runs from PDF page using pdfjs-dist
 */
async function extractTextRuns(file: File): Promise<TextRun[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // Form 15G is single page

  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1.0 });
  
  const textRuns: TextRun[] = [];

  for (const item of textContent.items) {
    if ('str' in item && item.str.trim()) {
      // Convert pdfjs coordinates (top-left origin) to bottom-left origin
      const transform = item.transform;
      const x = transform[4];
      const y = viewport.height - (transform[5] + item.height);
      
      textRuns.push({
        text: item.str,
        x,
        y,
        width: item.width,
        height: item.height
      });
    }
  }

  return textRuns;
}

/**
 * Find anchor points in PDF by fuzzy matching text runs
 */
export async function detectAnchors(file: File): Promise<AnchorPoint[]> {
  const textRuns = await extractTextRuns(file);
  const anchors: AnchorPoint[] = [];

  // Group nearby text runs into phrases
  const phrases: string[] = [];
  const phrasePositions: { x: number; y: number; width: number; height: number }[] = [];
  
  // Simple phrase grouping by proximity
  for (let i = 0; i < textRuns.length; i++) {
    let phrase = textRuns[i].text;
    let minX = textRuns[i].x;
    let maxX = textRuns[i].x + textRuns[i].width;
    let minY = textRuns[i].y;
    let maxY = textRuns[i].y + textRuns[i].height;
    
    // Look for adjacent text runs (within 20 points horizontally, 5 points vertically)
    for (let j = i + 1; j < textRuns.length; j++) {
      const distance = Math.abs(textRuns[j].x - (textRuns[i].x + textRuns[i].width));
      const verticalDistance = Math.abs(textRuns[j].y - textRuns[i].y);
      
      if (distance < 20 && verticalDistance < 5) {
        phrase += ' ' + textRuns[j].text;
        minX = Math.min(minX, textRuns[j].x);
        maxX = Math.max(maxX, textRuns[j].x + textRuns[j].width);
        minY = Math.min(minY, textRuns[j].y);
        maxY = Math.max(maxY, textRuns[j].y + textRuns[j].height);
        textRuns.splice(j, 1);
        j--;
      }
    }
    
    phrases.push(phrase);
    phrasePositions.push({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    });
  }

  // Match phrases against anchor set
  for (const targetAnchor of FORM_15G_ANCHORS) {
    let bestMatch: { phrase: string; position: any; confidence: number } | null = null;

    for (let i = 0; i < phrases.length; i++) {
      const normalizedPhrase = normalizeText(phrases[i]);
      const normalizedAnchor = normalizeText(targetAnchor);
      const confidence = calculateSimilarity(normalizedPhrase, normalizedAnchor);

      if (confidence >= 0.8 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = {
          phrase: phrases[i],
          position: phrasePositions[i],
          confidence
        };
      }
    }

    if (bestMatch) {
      // Calculate center point of the matched text
      const centerX = bestMatch.position.x + bestMatch.position.width / 2;
      const centerY = bestMatch.position.y + bestMatch.position.height / 2;

      anchors.push({
        text: targetAnchor,
        x: centerX,
        y: centerY,
        confidence: bestMatch.confidence
      });
    }
  }

  return anchors;
}