import CryptoJS from 'crypto-js';
import { CoordinateMap, detectCoordinates, validateAnchors } from './coordDetection';

// Persistent storage functions using localStorage
async function loadStoredCoordinates(): Promise<{ [key: string]: any }> {
  try {
    const stored = localStorage.getItem('pdf_coord_maps_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('TEMPLATE: Loaded stored coordinates from cache');
      return parsed;
    }
  } catch (error) {
    console.log('TEMPLATE: No stored coordinates found, will detect fresh');
  }
  return {};
}

async function saveStoredCoordinates(coordinates: { [key: string]: any }): Promise<void> {
  try {
    localStorage.setItem('pdf_coord_maps_v1', JSON.stringify(coordinates));
    console.log('TEMPLATE: Saved coordinates to localStorage for', Object.keys(coordinates).length, 'templates');
  } catch (error) {
    console.error('TEMPLATE: Failed to save coordinates:', error);
  }
}

// Canonical template hashes for embedded templates
const CANONICAL_15G_HASH = "embedded_15g_template"; // Placeholder - using embedded template
const CANONICAL_15H_HASH = "embedded_15h_template"; // Placeholder - using embedded template

export interface TemplateCache {
  hash: string;
  pageSize: { width: number; height: number };
  detectedAnchors: { [key: string]: { x: number; y: number } };
  affineMatrix?: {
    a: number; b: number; c: number;
    d: number; e: number; f: number;
  };
  coordinateMap?: CoordinateMap;
  lastUsed: number;
}

class TemplateManager {
  private cache: Map<string, TemplateCache> = new Map();

  /**
   * Calculate SHA-256 hash for a PDF file
   */
  async calculatePdfHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
    return CryptoJS.SHA256(wordArray).toString();
  }

  /**
   * Validate template against canonical hash
   * For embedded templates, we skip hash validation
   */
  async validateTemplate(file: File): Promise<{ valid: boolean; error?: string }> {
    try {
      // For embedded templates, we trust they are valid
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: "Failed to validate template file."
      };
    }
  }

  /**
   * Get cached template data
   */
  getCachedTemplate(hash: string): TemplateCache | null {
    const cached = this.cache.get(hash);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached;
    }
    return null;
  }

  /**
   * Cache template data
   */
  cacheTemplate(hash: string, data: Omit<TemplateCache, 'lastUsed'>): void {
    this.cache.set(hash, {
      ...data,
      lastUsed: Date.now()
    });
  }

  /**
   * Get or detect coordinate map for template
   */
  async getCoordinateMap(file: File, formType: '15G' | '15H'): Promise<CoordinateMap> {
    const hash = await this.calculatePdfHash(file);
    console.log(`TEMPLATE: Getting coordinate map for ${formType} (hash: ${hash})`);

    // Check memory cache first
    const memoryCache = this.getCachedTemplate(hash);
    if (memoryCache?.coordinateMap) {
      console.log(`TEMPLATE: Using memory cache for ${hash}`);
      return memoryCache.coordinateMap;
    }

    // Check persistent storage
    const storedCoords = await loadStoredCoordinates();
    const storageKey = `${hash}_${formType}`;
    
    if (storedCoords[storageKey]) {
      console.log(`TEMPLATE: Found stored coordinates for ${hash}`);
      const coordinateMap = storedCoords[storageKey];
      
      // Validate stored coordinates against current PDF
      const validation = await validateAnchors(file, coordinateMap, formType);
      if (validation.valid) {
        console.log(`TEMPLATE: Stored coordinates validated successfully`);
        // Cache in memory for faster access
        this.cacheTemplate(hash, {
          hash,
          pageSize: { width: coordinateMap.pageWidth, height: coordinateMap.pageHeight },
          detectedAnchors: coordinateMap.anchors,
          affineMatrix: null,
          coordinateMap
        });
        return coordinateMap;
      } else {
        console.log(`TEMPLATE: Stored coordinates invalid, will re-detect:`, validation.errors.join(', '));
      }
    }

    // Detect fresh coordinates
    console.log(`TEMPLATE: Detecting fresh coordinates for ${formType}`);
    try {
      const coordinateMap = await detectCoordinates(file, formType);
      
      if (Object.keys(coordinateMap.anchors).length === 0) {
        throw new Error('No text anchors detected - template may be image-based or corrupted');
      }
      
      // Cache in memory
      this.cacheTemplate(hash, {
        hash,
        pageSize: { width: coordinateMap.pageWidth, height: coordinateMap.pageHeight },
        detectedAnchors: coordinateMap.anchors,
        affineMatrix: null,
        coordinateMap
      });
      
      // Store persistently
      storedCoords[storageKey] = coordinateMap;
      await saveStoredCoordinates(storedCoords);
      
      console.log(`TEMPLATE: Successfully detected and cached coordinates for ${formType}`);
      return coordinateMap;
    } catch (error) {
      console.error('TEMPLATE: Coordinate detection failed:', error);
      throw new Error(`Template text not detected. Please use the official template or enable debug with ?debug=1. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear old cache entries (older than 24 hours)
   */
  cleanCache(): void {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [hash, data] of this.cache.entries()) {
      if (data.lastUsed < dayAgo) {
        this.cache.delete(hash);
      }
    }
  }
}

export const templateManager = new TemplateManager();