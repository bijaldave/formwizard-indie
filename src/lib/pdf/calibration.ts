import { PDFDocument, StandardFonts } from 'pdf-lib';
import CryptoJS from 'crypto-js';

export interface PercentRect {
  xPct: number; // 0..1 from left
  yPct: number; // 0..1 from top
  wPct: number; // 0..1 width
  hPct: number; // 0..1 height
}

export interface CalibrationData {
  [fieldKey: string]: PercentRect;
}

export interface CalibrationStore {
  templateHash: string;
  pageWidth: number; // base width used during calibration render
  pageHeight: number; // base height used during calibration render
  fields: CalibrationData;
  calibratedAt: string;
}

// Calculate PDF SHA-256 hash
export async function calculatePdfHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as any);
  return CryptoJS.SHA256(wordArray).toString();
}

// Save percent-based calibration data
export async function saveCalibrationData(
  formType: string,
  data: CalibrationData,
  baseWidth: number,
  baseHeight: number
): Promise<void> {
  const calibrationStore: CalibrationStore = {
    templateHash: '',
    pageWidth: baseWidth,
    pageHeight: baseHeight,
    fields: data,
    calibratedAt: new Date().toISOString()
  };
  localStorage.setItem(`calibration_${formType}`, JSON.stringify(calibrationStore));
}

// Load calibration fields only
export async function loadCalibrationData(formType: string): Promise<CalibrationData> {
  const stored = localStorage.getItem(`calibration_${formType}`);
  if (!stored) throw new Error('No calibration data found');
  const calibrationStore: CalibrationStore = JSON.parse(stored);
  return calibrationStore.fields;
}

// Build a fillable AcroForm shell PDF using percent rects
export async function buildAcroFormShell(
  templateFile: File,
  calibrationData: CalibrationData,
  formType: string
): Promise<Uint8Array> {
  try {
    const templateHash = await calculatePdfHash(templateFile);
    const pdfBytes = await templateFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPage(0);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const form = pdfDoc.getForm();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    Object.entries(calibrationData).forEach(([key, r]) => {
      const width = r.wPct * pageWidth;
      const height = r.hPct * pageHeight;
      const x = r.xPct * pageWidth;
      const y = pageHeight - r.yPct * pageHeight - height; // top-left -> bottom-left

      if (key.includes('_yes') || key.includes('_no')) {
        const cb = form.createCheckBox(key);
        cb.addToPage(page, { x, y, width, height });
        cb.defaultUpdateAppearances();
      } else if (key === 'signature_box') {
        // handled at fill time
      } else {
        const tf = form.createTextField(key);
        tf.addToPage(page, { x, y, width, height });
        tf.setFontSize(10);
        tf.defaultUpdateAppearances(font);
      }
    });

    // Persist hash + fields for validation
    const store: CalibrationStore = {
      templateHash,
      pageWidth,
      pageHeight,
      fields: calibrationData,
      calibratedAt: new Date().toISOString()
    };
    localStorage.setItem(`calibration_${formType}`, JSON.stringify(store));

    const out = await pdfDoc.save();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(out)));
    localStorage.setItem(`acroform_${formType}`, base64Pdf);
    return out;
  } catch (e) {
    console.error('Error building AcroForm shell:', e);
    throw new Error(`Failed to build AcroForm shell: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

export async function loadAcroFormShell(formType: string): Promise<Uint8Array | null> {
  const stored = localStorage.getItem(`acroform_${formType}`);
  if (!stored) return null;
  const bin = atob(stored);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function validateAcroFormShell(
  templateFile: File,
  formType: string
): Promise<{ valid: boolean; reason?: string }> {
  const cal = localStorage.getItem(`calibration_${formType}`);
  if (!cal) return { valid: false, reason: 'No calibration data found' };
  const acro = localStorage.getItem(`acroform_${formType}`);
  if (!acro) return { valid: false, reason: 'No AcroForm shell found' };

  const store: CalibrationStore = JSON.parse(cal);
  const currentHash = await calculatePdfHash(templateFile);
  if (store.templateHash !== currentHash) {
    return { valid: false, reason: 'Template has changed since calibration' };
  }
  return { valid: true };
}

// Return signature rect in percent space
export async function getSignaturePercentRect(formType: string): Promise<PercentRect | null> {
  const cal = localStorage.getItem(`calibration_${formType}`);
  if (!cal) return null;
  const store: CalibrationStore = JSON.parse(cal);
  return store.fields.signature_box || null;
}
