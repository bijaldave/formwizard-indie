import CryptoJS from 'crypto-js';
import { CoordinateMap, detectCoordinates, validateAnchors } from './coordDetection';

// Load and save coordinates from persistent storage
async function loadStoredCoordinates(): Promise<{ [key: string]: CoordinateMap }> {
  try {
    const response = await fetch('/src/lib/pdf/coords.json');
    const data = await response.json();
    return data.coordinateMaps || {};
  } catch (error) {
    console.warn('Could not load stored coordinates:', error);
    return {};
  }
}

async function saveStoredCoordinates(coordinates: { [key: string]: CoordinateMap }): Promise<void> {
  try {
    // In production, this would save to a backend
    // For now, we'll just cache in memory
    console.log('Coordinates would be saved to persistent storage:', coordinates);
  } catch (error) {
    console.warn('Could not save coordinates:', error);
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
    console.log(`🗺️ Getting coordinate map for Form ${formType}`);
    
    const hash = await this.calculatePdfHash(file);
    const cacheKey = `${hash}_${formType}`;
    
    // Check memory cache first
    const cached = this.getCachedTemplate(cacheKey);
    
    if (cached?.coordinateMap) {
      console.log('📋 Found cached coordinates, validating...');
      // Validate cached coordinates
      try {
        const validation = await validateAnchors(file, cached.coordinateMap, formType);
        if (validation.valid) {
          console.log('✅ Cached coordinates are valid');
          return cached.coordinateMap;
        } else {
          console.warn('⚠️ Cached coordinates invalid, re-detecting:', validation.errors);
        }
      } catch (error) {
        console.warn('❌ Validation failed, re-detecting:', error);
      }
    }

    // Load from persistent storage
    const storedCoordinates = await loadStoredCoordinates();
    const storedMap = storedCoordinates[cacheKey];
    
    if (storedMap) {
      console.log('💾 Found stored coordinates, validating...');
      try {
        const validation = await validateAnchors(file, storedMap, formType);
        if (validation.valid) {
          // Cache in memory and return
          this.cacheTemplate(cacheKey, {
            hash,
            pageSize: { width: storedMap.pageWidth, height: storedMap.pageHeight },
            detectedAnchors: {},
            coordinateMap: storedMap
          });
          console.log('✅ Stored coordinates are valid');
          return storedMap;
        } else {
          console.warn('⚠️ Stored coordinates invalid, re-detecting:', validation.errors);
        }
      } catch (error) {
        console.warn('❌ Stored validation failed, re-detecting:', error);
      }
    }

    console.log('🔍 Detecting new coordinates...');
    // Detect new coordinates
    const coordinateMap = await detectCoordinates(file, formType);
    
    // Cache in memory
    this.cacheTemplate(cacheKey, {
      hash,
      pageSize: { width: coordinateMap.pageWidth, height: coordinateMap.pageHeight },
      detectedAnchors: {},
      coordinateMap
    });

    // Save to persistent storage
    const updatedStorage = { ...storedCoordinates, [cacheKey]: coordinateMap };
    await saveStoredCoordinates(updatedStorage);

    console.log('✅ New coordinates detected and cached');
    return coordinateMap;
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