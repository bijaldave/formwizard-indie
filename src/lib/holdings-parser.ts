import * as XLSX from 'xlsx';

export type CanonicalKey = 'symbol' | 'security_name' | 'isin' | 'quantity';

export interface ParsedHolding {
  symbol: string;
  security_name: string;
  isin: string;
  quantity: number;
}

export interface ParseResult {
  holdings: ParsedHolding[];
  parsingInfo: {
    headerRow: number;
    sheetName: string;
    confidence: number;
    totalRows: number;
    rawRows: number;
    warnings: string[];
  };
  requiresMapping?: {
    ambiguousFields: Array<{
      canonical: CanonicalKey;
      candidates: Array<{
        column: string;
        score: number;
        preview: string[];
      }>;
    }>;
    fingerprint: string;
    headers: string[];
    sampleData: any[];
  };
}

// Comprehensive synonym dictionary with broker variations
const SYNONYMS: Record<CanonicalKey, string[]> = {
  symbol: [
    'symbol', 'ticker', 'trading symbol', 'security symbol', 'scrip', 'scrip code', 
    'code', 'stock code', 'share code', 'instrument code', 'security code',
    'script', 'script code', 'nse symbol', 'bse code', 'trading code'
  ],
  security_name: [
    'security name', 'scrip name', 'company', 'company name', 'security', 
    'instrument', 'name', 'stock name', 'share name', 'issuer name',
    'script name', 'company_name', 'instrument name', 'security_name',
    'issue name', 'desc', 'description', 'full name'
  ],
  isin: [
    'isin', 'isin code', 'isin_no', 'isin number', 'isin_code',
    'international security identification number', 'isin no'
  ],
  quantity: [
    'qty', 'quantity', 'quantity held', 'quantity available', 'net qty', 
    'free qty', 'holdings', 'balance', 'avail qty', 'available quantity',
    'shares', 'units', 'qty avail', 'available', 'holding qty', 'hold qty',
    'net quantity', 'total qty', 'actual qty', 'current qty'
  ]
};

// CSV delimiter detection patterns
const CSV_DELIMITERS = [',', ';', '\t', '|'];

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-\/\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeHeader(text).split(' ').filter(Boolean);
}

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[b.length][a.length];
}

function fuzzySimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

function jaccard(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function patternBoost(canonical: CanonicalKey, sampleValues: string[]): number {
  if (canonical === 'isin') {
    const isinPattern = /^IN[A-Z0-9]{10}$/;
    const matches = sampleValues.filter(v => 
      v && isinPattern.test(String(v).trim().toUpperCase())
    ).length;
    return matches > 0 ? 0.3 : 0;
  }
  
  if (canonical === 'quantity') {
    const qtyPattern = /^-?\s*[\d,]+(\.\d+)?\s*$/;
    const matches = sampleValues.filter(v => 
      v && qtyPattern.test(String(v).trim())
    ).length;
    return matches > sampleValues.length * 0.5 ? 0.2 : 0;
  }
  
  return 0;
}

function headerScore(canonical: CanonicalKey, candidateHeader: string, sampleValues: string[]): number {
  const normalized = normalizeHeader(candidateHeader);
  const candidateTokens = new Set(tokenize(candidateHeader));
  const synonyms = [canonical, ...SYNONYMS[canonical]];
  
  let synonymBoost = 0;
  let maxFuzzy = 0;
  let maxTokenOverlap = 0;
  
  synonyms.forEach(synonym => {
    const synNormalized = normalizeHeader(synonym);
    const synTokens = new Set(tokenize(synonym));
    
    // Exact match bonus
    if (normalized === synNormalized) {
      synonymBoost = Math.max(synonymBoost, 0.6);
    }
    
    // Fuzzy similarity
    const fuzzy = fuzzySimilarity(normalized, synNormalized);
    maxFuzzy = Math.max(maxFuzzy, fuzzy);
    
    // Token overlap (Jaccard similarity)
    const tokenOverlap = jaccard(candidateTokens, synTokens);
    maxTokenOverlap = Math.max(maxTokenOverlap, tokenOverlap);
  });
  
  const patternScore = patternBoost(canonical, sampleValues);
  
  // Composite score with weights
  const score = synonymBoost + (0.4 * maxFuzzy) + (0.3 * maxTokenOverlap) + patternScore;
  return Math.min(1, score);
}

function detectHeaderRow(rows: any[][], maxScan = 30): number {
  let bestIdx = 0;
  let bestScore = 0;
  
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    
    const nonEmptyCount = row.filter(cell => 
      cell !== null && cell !== undefined && String(cell).trim() !== ''
    ).length;
    
    // Skip rows with too few non-empty cells
    if (nonEmptyCount < 2) continue;
    
    // Score based on variety of content and string-like headers
    let score = 0;
    const headers = row.map(cell => String(cell || '').trim());
    
    headers.forEach(header => {
      if (header.length > 1) {
        // Bonus for text headers vs numbers
        if (!/^\d+(\.\d+)?$/.test(header)) score += 1;
        
        // Bonus for header-like patterns
        if (/^[a-zA-Z]/.test(header)) score += 0.5;
        if (header.includes(' ') || header.includes('_')) score += 0.2;
      }
    });
    
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  
  return bestIdx;
}

function selectBestSheet(workbook: XLSX.WorkBook): string {
  const sheetNames = workbook.SheetNames;
  
  if (sheetNames.length === 1) {
    return sheetNames[0];
  }
  
  // Priority 1: Sheet containing "equity" (case-insensitive)
  const equitySheet = sheetNames.find(name => 
    name.toLowerCase().includes('equity') || 
    name.toLowerCase().includes('stock') ||
    name.toLowerCase().includes('holding')
  );
  
  if (equitySheet) return equitySheet;
  
  // Priority 2: Sheet with most data rows
  let bestSheet = sheetNames[0];
  let maxRows = 0;
  
  sheetNames.forEach(sheetName => {
    try {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const nonEmptyRows = jsonData.filter(row => 
        Array.isArray(row) && row.some(cell => 
          cell !== null && cell !== undefined && String(cell).trim() !== ''
        )
      ).length;
      
      if (nonEmptyRows > maxRows) {
        maxRows = nonEmptyRows;
        bestSheet = sheetName;
      }
    } catch {
      // Skip problematic sheets
    }
  });
  
  return bestSheet;
}

function generateFingerprint(headers: string[], fileName?: string): string {
  const headerString = headers.join('|').toLowerCase();
  const filePrefix = fileName ? fileName.split('.')[0].substring(0, 10) : '';
  return btoa(filePrefix + headerString).substring(0, 16);
}

function getSampleValues(data: any[], columnIndex: number, headerRowIndex: number): string[] {
  const samples: string[] = [];
  const startRow = headerRowIndex + 1;
  
  for (let i = startRow; i < Math.min(startRow + 10, data.length); i++) {
    const row = data[i];
    if (Array.isArray(row) && row[columnIndex] !== null && row[columnIndex] !== undefined) {
      const value = String(row[columnIndex]).trim();
      if (value && !samples.includes(value)) {
        samples.push(value);
        if (samples.length >= 3) break;
      }
    }
  }
  
  return samples;
}

function toIntQuantity(value: any): number {
  if (value === null || value === undefined) return 0;
  
  const str = String(value).replace(/[,\s]/g, '');
  const num = parseInt(str, 10);
  
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function validateISIN(isin: string): string {
  if (!isin) return '';
  
  const cleaned = isin.trim().toUpperCase();
  return /^IN[A-Z0-9]{10}$/.test(cleaned) ? cleaned : '';
}

function deduplicateHoldings(holdings: ParsedHolding[]): ParsedHolding[] {
  const map = new Map<string, ParsedHolding>();
  
  holdings.forEach(holding => {
    const key = holding.isin || 
                `${holding.symbol}::${holding.security_name}`.toUpperCase();
    
    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.quantity += holding.quantity;
    } else {
      map.set(key, { ...holding });
    }
  });
  
  return Array.from(map.values()).filter(h => h.quantity > 0);
}

function loadMappingCache(fingerprint: string): Record<CanonicalKey, string> | null {
  try {
    const cached = localStorage.getItem(`brokerMapping:${fingerprint}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function saveMappingCache(fingerprint: string, mapping: Record<CanonicalKey, string>): void {
  try {
    localStorage.setItem(`brokerMapping:${fingerprint}`, JSON.stringify(mapping));
  } catch {
    // Ignore storage errors
  }
}

export function parseHoldingsFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Could not read file');
        
        let workbook: XLSX.WorkBook;
        let selectedSheet: string;
        let rawData: any[][];
        
        // Handle different file types
        if (file.name.toLowerCase().endsWith('.csv')) {
          // Try different delimiters for CSV
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          let bestDelimiter = ',';
          let maxColumns = 0;
          
          CSV_DELIMITERS.forEach(delimiter => {
            const lines = text.split('\n').slice(0, 3);
            const avgColumns = lines.reduce((sum, line) => sum + line.split(delimiter).length, 0) / lines.length;
            if (avgColumns > maxColumns) {
              maxColumns = avgColumns;
              bestDelimiter = delimiter;
            }
          });
          
          // For CSV, we need to handle it differently as XLSX doesn't support delimiter option
          const csvLines = text.split('\n');
          const csvData = csvLines.map(line => line.split(bestDelimiter));
          workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.aoa_to_sheet(csvData);
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
          selectedSheet = workbook.SheetNames[0];
        } else {
          workbook = XLSX.read(data, { type: 'binary' });
          selectedSheet = selectBestSheet(workbook);
        }
        
        const worksheet = workbook.Sheets[selectedSheet];
        rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (rawData.length === 0) {
          throw new Error('Selected sheet appears to be empty');
        }
        
        const headerRowIndex = detectHeaderRow(rawData);
        const headers = rawData[headerRowIndex].map((h: any) => String(h || '').trim()).filter(Boolean);
        
        if (headers.length < 2) {
          throw new Error('Could not detect valid headers');
        }
        
        const fingerprint = generateFingerprint(headers, file.name);
        const cachedMapping = loadMappingCache(fingerprint);
        
        // Calculate scores for each canonical field
        const fieldMappings: Record<CanonicalKey, Array<{ column: string; score: number; preview: string[] }>> = {
          symbol: [],
          security_name: [],
          isin: [],
          quantity: []
        };
        
        headers.forEach((header, index) => {
          const sampleValues = getSampleValues(rawData, index, headerRowIndex);
          
          Object.keys(fieldMappings).forEach(canonical => {
            const score = headerScore(canonical as CanonicalKey, header, sampleValues);
            if (score > 0.1) {
              fieldMappings[canonical as CanonicalKey].push({
                column: header,
                score,
                preview: sampleValues
              });
            }
          });
        });
        
        // Sort candidates by score
        Object.keys(fieldMappings).forEach(key => {
          fieldMappings[key as CanonicalKey].sort((a, b) => b.score - a.score);
        });
        
        // Auto-map confident matches or use cached mapping
        const mapping: Partial<Record<CanonicalKey, string>> = {};
        const ambiguousFields: Array<{
          canonical: CanonicalKey;
          candidates: Array<{ column: string; score: number; preview: string[] }>;
        }> = [];
        
        (Object.keys(fieldMappings) as CanonicalKey[]).forEach(canonical => {
          const candidates = fieldMappings[canonical];
          
          if (cachedMapping && cachedMapping[canonical]) {
            // Use cached mapping if available
            mapping[canonical] = cachedMapping[canonical];
          } else if (candidates.length > 0 && candidates[0].score >= 0.75) {
            // Auto-map confident matches
            mapping[canonical] = candidates[0].column;
          } else if (candidates.length > 0 && candidates[0].score >= 0.4) {
            // Mark as ambiguous
            ambiguousFields.push({
              canonical,
              candidates: candidates.slice(0, 3)
            });
          }
        });
        
        // Check if we need user input for mapping
        if (ambiguousFields.length > 0) {
          resolve({
            holdings: [],
            parsingInfo: {
              headerRow: headerRowIndex + 1,
              sheetName: selectedSheet,
              confidence: 0,
              totalRows: rawData.length - headerRowIndex - 1,
              rawRows: rawData.length,
              warnings: []
            },
            requiresMapping: {
              ambiguousFields,
              fingerprint,
              headers,
              sampleData: rawData.slice(headerRowIndex, headerRowIndex + 11)
            }
          });
          return;
        }
        
        // Validate we have minimum required fields
        const requiredFields: CanonicalKey[] = ['symbol', 'security_name', 'quantity'];
        const missingFields = requiredFields.filter(field => !mapping[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`Could not map required fields: ${missingFields.join(', ')}`);
        }
        
        // Parse data rows
        const results: ParsedHolding[] = [];
        const warnings: string[] = [];
        let negativeQuantityCount = 0;
        let cleanedQuantityCount = 0;
        
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          
          const rowObj: Record<string, any> = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index];
          });
          
          const symbol = String(rowObj[mapping.symbol!] || '').trim().toUpperCase();
          const securityName = String(rowObj[mapping.security_name!] || '').trim();
          const isinRaw = String(rowObj[mapping.isin!] || '').trim();
          const quantityRaw = rowObj[mapping.quantity!];
          
          if (!symbol || !securityName || !quantityRaw) continue;
          
          const isin = validateISIN(isinRaw);
          const originalQtyStr = String(quantityRaw);
          const quantity = toIntQuantity(quantityRaw);
          
          if (quantity <= 0) {
            if (String(quantityRaw).includes('-')) negativeQuantityCount++;
            continue;
          }
          
          if (originalQtyStr.includes(',') || /\s/.test(originalQtyStr)) {
            cleanedQuantityCount++;
          }
          
          results.push({
            symbol,
            security_name: securityName,
            isin,
            quantity
          });
        }
        
        if (negativeQuantityCount > 0) {
          warnings.push(`${negativeQuantityCount} negative quantities were set to 0`);
        }
        
        if (cleanedQuantityCount > 0) {
          warnings.push(`${cleanedQuantityCount} quantities were cleaned (removed commas/spaces)`);
        }
        
        const deduplicatedHoldings = deduplicateHoldings(results);
        const confidence = Math.min(100, Math.round(
          Object.values(mapping).reduce((sum, col) => {
            const candidates = Object.values(fieldMappings).flat();
            const candidate = candidates.find(c => c.column === col);
            return sum + (candidate?.score || 0);
          }, 0) / Object.keys(mapping).length * 100
        ));
        
        resolve({
          holdings: deduplicatedHoldings,
          parsingInfo: {
            headerRow: headerRowIndex + 1,
            sheetName: selectedSheet,
            confidence,
            totalRows: results.length,
            rawRows: rawData.length,
            warnings
          }
        });
        
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Could not read file'));
    
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

export function applyManualMapping(
  requiresMapping: NonNullable<ParseResult['requiresMapping']>,
  userMapping: Record<CanonicalKey, string>
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    try {
      // Save the mapping for future use
      saveMappingCache(requiresMapping.fingerprint, userMapping);
      
      const { headers, sampleData } = requiresMapping;
      const headerRowIndex = 0; // First row in sampleData is headers
      const dataRows = sampleData.slice(1);
      
      // Parse with the user-provided mapping
      const results: ParsedHolding[] = [];
      const warnings: string[] = [];
      let negativeQuantityCount = 0;
      let cleanedQuantityCount = 0;
      
      dataRows.forEach(row => {
        if (!Array.isArray(row) || row.length === 0) return;
        
        const rowObj: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowObj[header] = row[index];
        });
        
        const symbol = String(rowObj[userMapping.symbol] || '').trim().toUpperCase();
        const securityName = String(rowObj[userMapping.security_name] || '').trim();
        const isinRaw = String(rowObj[userMapping.isin] || '').trim();
        const quantityRaw = rowObj[userMapping.quantity];
        
        if (!symbol || !securityName || !quantityRaw) return;
        
        const isin = validateISIN(isinRaw);
        const originalQtyStr = String(quantityRaw);
        const quantity = toIntQuantity(quantityRaw);
        
        if (quantity <= 0) {
          if (String(quantityRaw).includes('-')) negativeQuantityCount++;
          return;
        }
        
        if (originalQtyStr.includes(',') || /\s/.test(originalQtyStr)) {
          cleanedQuantityCount++;
        }
        
        results.push({
          symbol,
          security_name: securityName,
          isin,
          quantity
        });
      });
      
      if (negativeQuantityCount > 0) {
        warnings.push(`${negativeQuantityCount} negative quantities were set to 0`);
      }
      
      if (cleanedQuantityCount > 0) {
        warnings.push(`${cleanedQuantityCount} quantities were cleaned (removed commas/spaces)`);
      }
      
      const deduplicatedHoldings = deduplicateHoldings(results);
      
      resolve({
        holdings: deduplicatedHoldings,
        parsingInfo: {
          headerRow: 1,
          sheetName: 'User Mapped',
          confidence: 100,
          totalRows: results.length,
          rawRows: sampleData.length,
          warnings
        }
      });
      
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Failed to apply mapping'));
    }
  });
}