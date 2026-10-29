---
name: wordpad-docx-compatibility
description: Use when changing DOCX import/export, OOXML parsing, images, lists, tables, formatting, or page setup compatibility in Wordpad JS.
---

# DOCX compatibility

Read the import/export sections of `docs/ARQUITETURA_E_DESENVOLVIMENTO.md` before making changes. Import and export are separate pipelines and must be considered independently.

## Pipelines

- Import entry point: `openFile()` in `src/App.tsx`.
- Primary import: `convertDocxToEditableHtml()` in `src/docx-import.ts`, using JSZip and browser XML APIs. It resolves OOXML relationships and translates the implemented subset into HTML.
- Import setup: `readDocxPageSetup()` reads page size/margins. Mammoth is a fallback path.
- Export entry point: `exportDocx()` in `src/App.tsx`.
- Export mapping: `prepareDocxImages()`, `inlineRuns()` and `docxBlocks()` map TipTap JSON into objects from the `docx` package. FileSaver downloads the generated document.

## Rules

- Do not claim pixel-perfect compatibility. Word, LibreOffice and Google Docs have different layout engines; preserve supported semantic content and formatting and state unsupported OOXML features clearly.
- Keep file parsing local to the browser and escape untrusted text/attributes during conversion. Never upload documents to a conversion service.
- Maintain image media, list numbering, hyperlinks, tables/cells, inline marks, page breaks, page size and margins when the relevant feature is touched.
- Be careful with units: OOXML uses twips for page/paragraph measurements and EMUs for drawing extents; browser CSS uses px/pt. Keep conversion formulas explicit and test round trips for sensible values.
- Preserve data URI MIME types and image dimensions. Check formats supported by the DOCX writer; convert unsupported browser image types locally where feasible.
- Avoid broad regex-only OOXML parsing when namespace-aware DOM APIs are available. Validate missing files, malformed XML, missing relationships and unknown image formats gracefully.
- Importer and exporter changes are separate; update both only when warranted and document which direction was addressed.

## Validation matrix

For meaningful conversion changes, use local samples with headings and inline formatting, font/color/highlight, ordered and unordered/nested lists, hyperlinks, tables with headers/cell shading, embedded images, manual page breaks, page size/margins and long paragraphs. Import, inspect/edit, export DOCX, and reopen in a compatible editor when available. Also run `pnpm build`. Describe features not represented by the editor schema or omitted by conversion.
