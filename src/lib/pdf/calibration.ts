import { PDFDocument, PDFTextField, PDFCheckBox, StandardFonts } from 'pdf-lib';
import CryptoJS from 'crypto-js';

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalibrationData {
  [fieldKey: string]: Rectangle;
}

export interface CalibrationStore {
  templateHash: string;
  pageWidth: number;
  pageHeight: string;
  fields: CalibrationData;
  calibratedAt: string;
}

/**
 * Calculate PDF hash for template validation
 */
export async function calculatePdfHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
  return CryptoJS.SHA256(wordArray).toString();
}

/**
 * Save calibration data to localStorage
 */
export async function saveCalibrationData(formType: string, data: CalibrationData): Promise<void> {
  const calibrationStore: CalibrationStore = {
    templateHash: '', // Will be set when building AcroForm
    pageWidth: 0,
    pageHeight: '',
    fields: data,
    calibratedAt: new Date().toISOString()
  };
  
  localStorage.setItem(`calibration_${formType}`, JSON.stringify(calibrationStore));
}

/**
 * Load calibration data from localStorage
 */
export async function loadCalibrationData(formType: string): Promise<CalibrationData> {
  const stored = localStorage.getItem(`calibration_${formType}`);
  if (!stored) {
    throw new Error('No calibration data found');
  }
  
  const calibrationStore: CalibrationStore = JSON.parse(stored);
  return calibrationStore.fields;
}

/**
 * Build AcroForm shell with fillable fields
 */
export async function buildAcroFormShell(
  templateFile: File,
  calibrationData: CalibrationData,
  formType: string
): Promise<Uint8Array> {
  try {
    // Calculate template hash for validation
    const templateHash = await calculatePdfHash(templateFile);
    
    // Load the source PDF
    const arrayBuffer = await templateFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const page = pdfDoc.getPage(0);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    
    // Embed font for text fields
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Create AcroForm
    const form = pdfDoc.getForm();
    
    // Add fields based on calibration data
    Object.entries(calibrationData).forEach(([fieldKey, rect]) => {
      // Convert coordinates (PDF uses bottom-left origin, calibration uses top-left)
      const pdfY = pageHeight - rect.y - rect.height;
      
      if (fieldKey.includes('_yes') || fieldKey.includes('_no')) {
        // Create checkbox for yes/no fields
        const checkbox = form.createCheckBox(fieldKey);
        checkbox.addToPage(page, {
          x: rect.x,
          y: pdfY,
          width: rect.width,
          height: rect.height
        });
        
        // Style the checkbox
        checkbox.defaultUpdateAppearances();
      } else if (fieldKey === 'signature_box') {
        // For signature, we'll handle this as a special case during filling
        // Just store the coordinates for later image placement
        console.log(`Signature box coordinates stored: ${JSON.stringify(rect)}`);
      } else {
        // Create text field
        const textField = form.createTextField(fieldKey);
        textField.addToPage(page, {
          x: rect.x,
          y: pdfY,
          width: rect.width,
          height: rect.height
        });
        
        // Style the text field
        textField.setFontSize(10);
        textField.defaultUpdateAppearances(font);
      }
    });
    
    // Save calibration metadata with hash
    const calibrationStore: CalibrationStore = {
      templateHash,
      pageWidth,
      pageHeight: pageHeight.toString(),
      fields: calibrationData,
      calibratedAt: new Date().toISOString()
    };
    localStorage.setItem(`calibration_${formType}`, JSON.stringify(calibrationStore));
    
    // Save the AcroForm PDF
    const pdfBytes = await pdfDoc.save();
    
    // Store the AcroForm shell in localStorage (base64 encoded)
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    localStorage.setItem(`acroform_${formType}`, base64Pdf);
    
    console.log(`AcroForm shell built for Form ${formType} with ${Object.keys(calibrationData).length} fields`);
    
    return pdfBytes;
    
  } catch (error) {
    console.error('Error building AcroForm shell:', error);
    throw new Error(`Failed to build AcroForm shell: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load AcroForm shell from localStorage
 */
export async function loadAcroFormShell(formType: string): Promise<Uint8Array | null> {
  try {
    const stored = localStorage.getItem(`acroform_${formType}`);
    if (!stored) {
      return null;
    }
    
    // Decode base64 to bytes
    const binaryString = atob(stored);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  } catch (error) {
    console.error('Error loading AcroForm shell:', error);
    return null;
  }
}

/**
 * Validate if AcroForm shell matches current template
 */
export async function validateAcroFormShell(
  templateFile: File,
  formType: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Check if calibration data exists
    const calibrationStore = localStorage.getItem(`calibration_${formType}`);
    if (!calibrationStore) {
      return { valid: false, reason: 'No calibration data found' };
    }
    
    const calibration: CalibrationStore = JSON.parse(calibrationStore);
    
    // Check if AcroForm shell exists
    const acroFormExists = localStorage.getItem(`acroform_${formType}`);
    if (!acroFormExists) {
      return { valid: false, reason: 'No AcroForm shell found' };
    }
    
    // Validate template hash
    const currentHash = await calculatePdfHash(templateFile);
    if (calibration.templateHash !== currentHash) {
      return { valid: false, reason: 'Template has changed since calibration' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'Validation error: ' + (error instanceof Error ? error.message : 'Unknown error') };
  }
}

/**
 * Get signature box coordinates for manual placement
 */
export async function getSignatureCoordinates(formType: string): Promise<Rectangle | null> {
  try {
    const calibrationData = await loadCalibrationData(formType);
    return calibrationData.signature_box || null;
  } catch (error) {
    console.error('Error getting signature coordinates:', error);
    return null;
  }
}