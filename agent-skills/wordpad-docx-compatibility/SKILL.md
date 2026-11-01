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
- To keep exported spacing close to the editor, derive twips from the same CSS the editor uses (`src/style.css`) and prefer `LineRuleType.EXACT` over `AUTO`; Word recomputes `AUTO` from the font's own metrics and drifts from the on-screen line height. Paragraph borders are anchored to the first line, so account for list hanging indents when positioning a quote bar.
- List spacing lives in the list container, not in each item: only the last item of the outermost list carries `after: 240`. When two lists of the same kind are adjacent in the JSON, or separated only by a page break (pagination splits a list that crosses a page), treat them as one list and skip that trailing margin on the first chunk (`DocxBlockContext.listContinues`); otherwise Word shows a gap in the middle of the list. Ordered chunks only count as a continuation when the numbering follows on (`isListContinuation()`), so a deliberate `<ol>` restart keeps its margin.
- Pagination stores a page-crossing list as two nodes with an automatic break between them. If a later reflow drops the break, `paginateDocument()` rejoins the adjacent chunks (`isListContinuation()`); only join chunks that are already adjacent, and for ordered lists only when numbering continues, so deliberate `<ol>` restarts stay separate.
- Headings carry `keepNext` so they are never orphaned at the bottom of a page. A manual `pageBreak` sitting immediately after a heading is moved onto the heading itself (`pageBreakBefore`) instead of the next block: Word/LibreOffice repaginate with their own font metrics and would otherwise push the heading to the next sheet while the break sends the content one sheet further, producing an almost blank page. Never move the break when the heading is the first block (`children.length > 1`).
- Do not export the automatic `pageBreak` nodes that `paginateDocument()` creates. They encode the browser's pagination; Word/LibreOffice measure fonts differently, so a baked-in break can end up a few lines off and leave an almost blank page (a lone heading or list item) right where the user sees a large gap. Only breaks with `automatic: false` (inserted by the user or imported as manual) become `pageBreakBefore`. Test with a paginated document that crosses pages in the middle of a list: the exported file must contain no `pageBreakBefore` from pagination and the mid-list trailing `after: 240` must stay absent.
- Preserve data URI MIME types and image dimensions. Check formats supported by the DOCX writer; convert unsupported browser image types locally where feasible.
- Avoid broad regex-only OOXML parsing when namespace-aware DOM APIs are available. Validate missing files, malformed XML, missing relationships and unknown image formats gracefully.
- Importer and exporter changes are separate; update both only when warranted and document which direction was addressed.

## Validation matrix

For meaningful conversion changes, use local samples with headings and inline formatting, font/color/highlight, ordered and unordered/nested lists, hyperlinks, tables with headers/cell shading, embedded images, manual page breaks, page size/margins and long paragraphs. Import, inspect/edit, export DOCX, and reopen in a compatible editor when available. Also run `pnpm build`. Describe features not represented by the editor schema or omitted by conversion.
