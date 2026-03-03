import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { extractFromBuffer, extractFromBase64, extractFromUrl } from '../src/extract';

/**
 * Build a minimal valid PDF buffer with the given text content.
 * This creates a proper PDF 1.4 structure with a single page.
 */
function buildMinimalPdf(text: string = 'Hello World'): Buffer {
  const streamContent = `BT /F1 12 Tf 100 700 Td (${text}) Tj ET`;
  const streamLength = streamContent.length;

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
  const obj4 = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj5 =
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  const header = '%PDF-1.4\n';

  // Calculate byte offsets for xref
  const offsets: number[] = [];
  let pos = header.length;

  offsets.push(pos); // obj1
  pos += obj1.length;

  offsets.push(pos); // obj2
  pos += obj2.length;

  offsets.push(pos); // obj3
  pos += obj3.length;

  offsets.push(pos); // obj4
  pos += obj4.length;

  offsets.push(pos); // obj5
  pos += obj5.length;

  const xrefOffset = pos;

  const xref = [
    'xref',
    '0 6',
    '0000000000 65535 f ',
    offsets[0].toString().padStart(10, '0') + ' 00000 n ',
    offsets[1].toString().padStart(10, '0') + ' 00000 n ',
    offsets[2].toString().padStart(10, '0') + ' 00000 n ',
    offsets[3].toString().padStart(10, '0') + ' 00000 n ',
    offsets[4].toString().padStart(10, '0') + ' 00000 n ',
  ].join('\n') + '\n';

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const pdfString = header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer;
  return Buffer.from(pdfString, 'binary');
}

/**
 * Build a minimal PDF with metadata (Title and Author in the Info dictionary).
 */
function buildPdfWithMetadata(
  text: string,
  title: string,
  author: string
): Buffer {
  const streamContent = `BT /F1 12 Tf 100 700 Td (${text}) Tj ET`;
  const streamLength = streamContent.length;

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
  const obj4 = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj5 =
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  const obj6 = `6 0 obj\n<< /Title (${title}) /Author (${author}) >>\nendobj\n`;

  const header = '%PDF-1.4\n';

  const offsets: number[] = [];
  let pos = header.length;

  offsets.push(pos);
  pos += obj1.length;
  offsets.push(pos);
  pos += obj2.length;
  offsets.push(pos);
  pos += obj3.length;
  offsets.push(pos);
  pos += obj4.length;
  offsets.push(pos);
  pos += obj5.length;
  offsets.push(pos);
  pos += obj6.length;

  const xrefOffset = pos;

  const xref = [
    'xref',
    '0 7',
    '0000000000 65535 f ',
    offsets[0].toString().padStart(10, '0') + ' 00000 n ',
    offsets[1].toString().padStart(10, '0') + ' 00000 n ',
    offsets[2].toString().padStart(10, '0') + ' 00000 n ',
    offsets[3].toString().padStart(10, '0') + ' 00000 n ',
    offsets[4].toString().padStart(10, '0') + ' 00000 n ',
    offsets[5].toString().padStart(10, '0') + ' 00000 n ',
  ].join('\n') + '\n';

  const trailer = `trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const pdfString = header + obj1 + obj2 + obj3 + obj4 + obj5 + obj6 + xref + trailer;
  return Buffer.from(pdfString, 'binary');
}

// ─── extractFromBuffer ──────────────────────────────────────────────

describe('extractFromBuffer', () => {
  it('should extract text from a minimal valid PDF', async () => {
    const pdf = buildMinimalPdf('Hello World');
    const result = await extractFromBuffer(pdf);

    expect(result.text).toContain('Hello World');
    expect(result.extractedAt).toBeTruthy();
    expect(typeof result.durationMs).toBe('number');
  });

  it('should return correct result structure', async () => {
    const pdf = buildMinimalPdf('Test');
    const result = await extractFromBuffer(pdf);

    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('pages');
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('extractedAt');
    expect(result).toHaveProperty('durationMs');
    expect(Array.isArray(result.pages)).toBe(true);
  });

  it('should populate page information', async () => {
    const pdf = buildMinimalPdf('Page content here');
    const result = await extractFromBuffer(pdf);

    expect(result.pages.length).toBeGreaterThanOrEqual(1);
    expect(result.pages[0]).toHaveProperty('number');
    expect(result.pages[0]).toHaveProperty('text');
    expect(result.pages[0].number).toBe(1);
  });

  it('should populate metadata with pageCount', async () => {
    const pdf = buildMinimalPdf('Metadata test');
    const result = await extractFromBuffer(pdf);

    expect(result.metadata).toHaveProperty('pageCount');
    expect(result.metadata.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('should calculate word count', async () => {
    const pdf = buildMinimalPdf('one two three four five');
    const result = await extractFromBuffer(pdf);

    expect(result.metadata.wordCount).toBeGreaterThanOrEqual(1);
    expect(typeof result.metadata.wordCount).toBe('number');
  });

  it('should extract metadata title and author when present', async () => {
    const pdf = buildPdfWithMetadata('Content', 'My Title', 'John Doe');
    const result = await extractFromBuffer(pdf);

    expect(result.metadata.title).toBe('My Title');
    expect(result.metadata.author).toBe('John Doe');
  });

  it('should return null for title and author when not present', async () => {
    const pdf = buildMinimalPdf('No metadata');
    const result = await extractFromBuffer(pdf);

    expect(result.metadata.title).toBeNull();
    expect(result.metadata.author).toBeNull();
  });

  it('should provide a valid ISO timestamp in extractedAt', async () => {
    const pdf = buildMinimalPdf('Timestamp test');
    const result = await extractFromBuffer(pdf);

    const parsed = new Date(result.extractedAt);
    expect(parsed.toISOString()).toBe(result.extractedAt);
  });

  it('should record a non-negative durationMs', async () => {
    const pdf = buildMinimalPdf('Duration test');
    const result = await extractFromBuffer(pdf);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should throw for an empty buffer', async () => {
    const emptyBuf = Buffer.alloc(0);
    await expect(extractFromBuffer(emptyBuf)).rejects.toThrow('Empty or invalid PDF buffer');
  });

  it('should throw for a null/undefined buffer', async () => {
    // @ts-expect-error deliberately passing invalid input
    await expect(extractFromBuffer(null)).rejects.toThrow('Empty or invalid PDF buffer');
    // @ts-expect-error deliberately passing invalid input
    await expect(extractFromBuffer(undefined)).rejects.toThrow('Empty or invalid PDF buffer');
  });

  it('should throw for non-PDF data', async () => {
    const notPdf = Buffer.from('This is not a PDF file at all');
    await expect(extractFromBuffer(notPdf)).rejects.toThrow('Failed to parse PDF');
  });

  it('should throw when buffer exceeds 10MB', async () => {
    const oversized = Buffer.alloc(11 * 1024 * 1024, 0);
    await expect(extractFromBuffer(oversized)).rejects.toThrow('exceeds maximum allowed size of 10MB');
  });

  it('should accept a buffer just under 10MB', async () => {
    // We can't actually make a valid 9.9MB PDF easily,
    // but we verify the size check passes and it fails on parse, not size.
    const almostMax = Buffer.alloc(9 * 1024 * 1024, 0);
    await expect(extractFromBuffer(almostMax)).rejects.toThrow('Failed to parse PDF');
  });
});

// ─── extractFromBase64 ──────────────────────────────────────────────

describe('extractFromBase64', () => {
  it('should decode and extract text from a base64-encoded PDF', async () => {
    const pdf = buildMinimalPdf('Base64 test');
    const b64 = pdf.toString('base64');
    const result = await extractFromBase64(b64);

    expect(result.text).toContain('Base64');
  });

  it('should handle data URI prefix', async () => {
    const pdf = buildMinimalPdf('Data URI test');
    const b64 = 'data:application/pdf;base64,' + pdf.toString('base64');
    const result = await extractFromBase64(b64);

    expect(result.text).toContain('Data URI');
  });

  it('should throw for empty string', async () => {
    await expect(extractFromBase64('')).rejects.toThrow('A valid base64 string is required');
  });

  it('should throw for non-string input', async () => {
    // @ts-expect-error deliberately passing invalid input
    await expect(extractFromBase64(null)).rejects.toThrow('A valid base64 string is required');
  });

  it('should throw for invalid base64 characters', async () => {
    await expect(extractFromBase64('not!valid@base64#')).rejects.toThrow('Invalid base64 encoding');
  });
});

// ─── extractFromUrl ─────────────────────────────────────────────────

describe('extractFromUrl', () => {
  it('should throw for empty URL', async () => {
    await expect(extractFromUrl('')).rejects.toThrow('A valid URL string is required');
  });

  it('should throw for invalid URL format', async () => {
    await expect(extractFromUrl('not-a-url')).rejects.toThrow('Invalid URL');
  });

  it('should throw for non-HTTP protocols', async () => {
    await expect(extractFromUrl('ftp://example.com/file.pdf')).rejects.toThrow(
      'Unsupported protocol'
    );
  });

  it('should throw for non-string input', async () => {
    // @ts-expect-error deliberately passing invalid input
    await expect(extractFromUrl(null)).rejects.toThrow('A valid URL string is required');
  });

  it('should throw a descriptive error for failed network request', async () => {
    // Use a URL that will fail to connect (non-routable IP)
    // We mock fetch to avoid real network calls
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() => {
      throw new Error('Network failure simulated');
    }) as any;

    try {
      await expect(extractFromUrl('https://example.com/test.pdf')).rejects.toThrow(
        'Failed to fetch PDF from URL'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should throw for non-OK HTTP responses', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 404 }))
    ) as any;

    try {
      await expect(extractFromUrl('https://example.com/missing.pdf')).rejects.toThrow('HTTP 404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should successfully extract text when fetch returns valid PDF', async () => {
    const pdf = buildMinimalPdf('Fetched content');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(pdf, { status: 200 }))
    ) as any;

    try {
      const result = await extractFromUrl('https://example.com/valid.pdf');
      expect(result.text).toContain('Fetched content');
      expect(result.metadata.pageCount).toBeGreaterThanOrEqual(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
