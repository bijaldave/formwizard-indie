import CryptoJS from 'crypto-js';

// Canonical template hash for Form 15G (computed from 15G_UPDATED-4.pdf)
const CANONICAL_15G_HASH = "15G_TEMPLATE_HASH_PLACEHOLDER";

export interface TemplateCache {
  hash: string;
  pageSize: { width: number; height: number };
  detectedAnchors: { [key: string]: { x: number; y: number } };
  affineMatrix?: {
    a: number; b: number; c: number;
    d: number; e: number; f: number;
  };
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
   */
  async validateTemplate(file: File): Promise<{ valid: boolean; error?: string }> {
    try {
      const hash = await this.calculatePdfHash(file);
      
      if (hash !== CANONICAL_15G_HASH) {
        return {
          valid: false,
          error: "This form isn't the calibrated template. Upload the pinned template or recalibrate."
        };
      }

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