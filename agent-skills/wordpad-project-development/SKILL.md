---
name: wordpad-project-development
description: Use when implementing, reviewing, or documenting general features in the Wordpad JS offline rich-text editor repository.
---

# Wordpad project development

Use this skill for general implementation work in this repository. Read `docs/ARQUITETURA_E_DESENVOLVIMENTO.md` first for the full architecture and function map.

## Core constraints

- This is a browser-only React + TypeScript app. Do not introduce a backend, remote document processing, online database, or network upload for user content.
- The rich-text source of truth is TipTap/ProseMirror. Apply changes through editor commands/transactions; do not mutate the editable DOM directly.
- Keep user content local. It is autosaved to `localStorage` under `wordpad-documents-v1`; exports are separate downloads.
- Respect selection/focus when adding toolbar commands. Use `editor.chain().focus()` for formatting and insertion actions where appropriate.
- Preserve accessibility: button names, keyboard focus, active and disabled states, and understandable hover feedback.

## Where to work

- `src/App.tsx`: editor extensions, document/page state, toolbar and menus, save/import/export flows, pagination, rulers, image editing, help dialog.
- `src/docx-import.ts`: DOCX OOXML to editable HTML conversion.
- `src/style.css`: app layout, page canvas, pagination visuals, toolbars, rulers, responsive and print rules.
- `docs/GUIA_DO_USUARIO.md` and `public/guia-do-usuario.html`: paired user guide sources; keep their meaning in sync when UI changes.
- `docs/ARQUITETURA_E_DESENVOLVIMENTO.md`: technical architecture and workflow reference.

## Editing workflow

1. Search the existing symbol and all matching CSS selectors with `rg` before changing behavior or adding styles.
2. Preserve existing document schema and local storage compatibility. Add TipTap attributes with HTML parse/render support if values must survive reload or export.
3. Keep units explicit: paper dimensions are mm, margins inches, browser geometry px, font size pt, DOCX page setup twips, and image extents often EMU.
4. Keep the UI compact and consistent with existing toolbar/dropdown patterns. Prefer installed lucide-react icons over new icon dependencies.
5. Update user documentation for changed behavior and developer documentation for architecture changes.
6. Run `pnpm build`. For layout, pagination, print, or file conversion, verify the relevant behavior separately; a successful build does not verify rendering fidelity.

## Completion report

State what changed, the paths affected, the validation performed, and unsupported file features or rendering limitations discovered. Do not claim full Word equivalence; DOCX conversion is bounded by the implemented OOXML subset.
