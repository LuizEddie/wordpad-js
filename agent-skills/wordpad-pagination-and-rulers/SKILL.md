---
name: wordpad-pagination-and-rulers
description: Use when changing page sizing, automatic/manual page breaks, text flow, page rulers, margin handles, printing layout, or page-count calculations in Wordpad JS.
---

# Pagination and ruler changes

Read `docs/ARQUITETURA_E_DESENVOLVIMENTO.md`, especially “Paginação e papel,” before editing. The page model is browser geometry layered over a continuous TipTap document; page boundaries are represented by the custom `pageBreak` block node.

## Invariants

- Keep manual breaks (`automatic: false`) separate from generated breaks (`automatic: true`). Reflow may remove/recalculate only automatic breaks.
- Never insert breaks one ProseMirror position off. Top-level `doc.forEach` offsets already identify the position before each node.
- Keep document content inside the useful page area and out of the visual inter-page gap, including long paragraphs, lists, tables and floated images.
- For bullet and numbered lists, keep content that fits on the current page. Split between list items when the next item overflows; if a paragraph inside a list item crosses the page limit, split its text and continue the item without repeating its bullet/number. Preserve following ordered-list numbering in continuation fragments.
- Reflow transactions must not pollute user undo history. Avoid recursive pagination dispatch; respect the `paginating` guard and reflow callback.
- Preserve selected paper dimensions and keep CSS `@page`, visible sheet size, margin fields and rulers in agreement.
- Horizontal and vertical rulers should share visual styling, scale/tick rhythm, border treatment, handles and pointer behavior while retaining their respective axes.
- Margin drag math must be clamped to valid limits, measured against the correct ruler/page geometry, and stay synchronized with numeric Layout inputs.
- Check `@media print`: screen-only gaps, rulers and canvas backgrounds should not create extra printed content.

## Key code

- `PAPER_SIZES`, `PAGE_GAP`, `paginateDocument()` and `findTextSplitPosition()` in `src/App.tsx`.
- `adjustMargin()` and ruler JSX in `src/App.tsx`.
- `.page-layout`, `.horizontal-ruler`, `.vertical-ruler`, `.ruler-handle`, `.page-break`, `article`, `.document-editor`, and `@media print` in `src/style.css`.

## Validation

Build with `pnpm build`, then inspect interactions at more than one paper size and margin configuration. Include text reaching a page boundary, a paragraph taller than one page, a manual break, images/tables near a boundary, drag plus numeric margin edits, and print/PDF preview. Confirm text never occupies the gray gap and every page has the selected dimensions. Report browser-dependent behavior.
