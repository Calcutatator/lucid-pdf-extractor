import pdfParse from 'pdf-parse';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface PageInfo {
  number: number;
  text: string;
}

export interface PdfMetadata {
  title: string | null;
  author: string | null;
  pageCount: number;
  wordCount: number;
}

export interface ExtractionResult {
  text: string;
  pages: PageInfo[];
  metadata: PdfMetadata;
  extractedAt: string;
  durationMs: number;
}

/**
 * Extract text content from a PDF buffer using pdf-parse.
 */
export async function extractFromBuffer(buffer: Buffer): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty or invalid PDF buffer provided');
  }

  if (buffer.length > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `PDF size (${(buffer.length / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of 10MB`
    );
  }

  const start = performance.now();

  let data: Awaited<ReturnType<typeof pdfParse>>;
  try {
    data = await pdfParse(buffer);
  } catch (err: any) {
    throw new Error(`Failed to parse PDF: ${err?.message ?? 'Unknown error'}`);
  }

  const fullText = data.text ?? '';

  // Split text into pages using form-feed characters if present,
  // otherwise treat entire text as a single page.
  const rawPages = fullText.includes('\f')
    ? fullText.split('\f')
    : [fullText];

  const pages: PageInfo[] = rawPages
    .map((text, idx) => ({
      number: idx + 1,
      text: text.trim(),
    }))
    .filter((p) => p.text.length > 0 || rawPages.length === 1);

  // If all pages filtered out (entirely empty PDF), keep at least one empty page
  if (pages.length === 0) {
    pages.push({ number: 1, text: '' });
  }

  const wordCount = fullText
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const metadata: PdfMetadata = {
    title: data.info?.Title || null,
    author: data.info?.Author || null,
    pageCount: data.numpages ?? pages.length,
    wordCount,
  };

  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  return {
    text: fullText.trim(),
    pages,
    metadata,
    extractedAt: new Date().toISOString(),
    durationMs,
  };
}

/**
 * Fetch a PDF from a URL and extract its text content.
 */
export async function extractFromUrl(url: string): Promise<ExtractionResult> {
  if (!url || typeof url !== 'string') {
    throw new Error('A valid URL string is required');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol} - only HTTP and HTTPS are supported`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/pdf',
      },
    });
  } catch (err: any) {
    throw new Error(`Failed to fetch PDF from URL: ${err?.message ?? 'Network error'}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch PDF from ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return extractFromBuffer(buffer);
}

/**
 * Decode a base64-encoded PDF and extract its text content.
 */
export async function extractFromBase64(base64: string): Promise<ExtractionResult> {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('A valid base64 string is required');
  }

  // Strip optional data URI prefix
  const cleaned = base64.replace(/^data:application\/pdf;base64,/, '').trim();

  if (cleaned.length === 0) {
    throw new Error('Empty base64 string provided');
  }

  // Validate base64 characters
  if (!/^[A-Za-z0-9+/\n\r]+=*$/.test(cleaned)) {
    throw new Error('Invalid base64 encoding');
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleaned, 'base64');
  } catch (err: any) {
    throw new Error(`Failed to decode base64: ${err?.message ?? 'Unknown error'}`);
  }

  if (buffer.length === 0) {
    throw new Error('Base64 decoded to empty buffer');
  }

  return extractFromBuffer(buffer);
}
