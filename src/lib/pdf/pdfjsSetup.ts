import * as pdfjsLib from 'pdfjs-dist';
// Use Vite to bundle worker and serve locally to avoid CDN/CORS issues
// This resolves "Setting up fake worker failed" errors
// NOTE: pdfjs v4 expects the worker script to be an ES module (.mjs)
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerUrl;

export default pdfjsLib;
