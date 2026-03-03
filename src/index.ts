import { createAgent } from '@lucid-agents/core';
import { createAgentApp } from '@lucid-agents/hono';
import { http } from '@lucid-agents/http';
import { payments, paymentsFromEnv } from '@lucid-agents/payments';
import { z } from 'zod';
import { extractFromUrl, extractFromBase64 } from './extract';

const PageSchema = z.object({
  number: z.number(),
  text: z.string(),
});

const MetadataSchema = z.object({
  title: z.string().nullable(),
  author: z.string().nullable(),
  pageCount: z.number(),
  wordCount: z.number(),
});

const ExtractionOutputSchema = z.object({
  text: z.string(),
  pages: z.array(PageSchema),
  metadata: MetadataSchema,
  extractedAt: z.string(),
  durationMs: z.number(),
});

const agent = await createAgent({
  name: 'pdf-extractor',
  version: '1.0.0',
  description: 'PDF text extraction API. Extracts text, page content, and metadata from PDF documents provided via URL or base64 encoding.',
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(agent);

addEntrypoint({
  id: 'extract-url',
  name: 'Extract PDF from URL',
  description: 'Fetches a PDF from the given URL and extracts its text content, page information, and metadata.',
  price: '$0.003',
  input: z.object({
    url: z.string().url().describe('The URL of the PDF to extract text from'),
  }),
  output: ExtractionOutputSchema,
  handler: async ({ input }) => {
    const result = await extractFromUrl(input.url);
    return result;
  },
});

addEntrypoint({
  id: 'extract-base64',
  name: 'Extract PDF from Base64',
  description: 'Decodes a base64-encoded PDF and extracts its text content, page information, and metadata.',
  price: '$0.003',
  input: z.object({
    base64: z.string().describe('The base64-encoded PDF content'),
  }),
  output: ExtractionOutputSchema,
  handler: async ({ input }) => {
    const result = await extractFromBase64(input.base64);
    return result;
  },
});

const port = Number(process.env.PORT ?? 3000);
const server = Bun.serve({ port, fetch: app.fetch });
console.log(`pdf-extractor agent running on port ${port}`);
