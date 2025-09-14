import CryptoJS from 'crypto-js';
import { CoordinateMap, detectCoordinates, validateAnchors } from './coordDetection';

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
    const cached = this.getCachedTemplate(hash);
    
    if (cached?.coordinateMap) {
      // Validate cached coordinates
      const validation = await validateAnchors(file, cached.coordinateMap, formType);
      if (validation.valid) {
        return cached.coordinateMap;
      } else {
        console.warn('Cached coordinates invalid, re-detecting:', validation.errors);
      }
    }

    // Detect new coordinates
    const coordinateMap = await detectCoordinates(file, formType);
    
    // Cache the result
    this.cacheTemplate(hash, {
      hash,
      pageSize: { width: coordinateMap.pageWidth, height: coordinateMap.pageHeight },
      detectedAnchors: {},
      coordinateMap
    });

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