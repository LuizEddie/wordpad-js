import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { Editor, Extension, Node, type NodeViewProps } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, ExternalHyperlink, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, AlignmentType, BorderStyle, LineRuleType, type ParagraphChild } from 'docx'
import { saveAs } from 'file-saver'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import { convertDocxToEditableHtml } from './docx-import'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Check, ChevronDown, CircleHelp, Printer,
  ClipboardPaste, Code2, Copy, FilePlus2, FileText, Highlighter, ImagePlus, Italic, Link2,
  List, ListOrdered, Menu, Minus, Plus, Quote, Redo2, Save, Strikethrough,
  Table2, Underline as UnderlineIcon, Undo2, Upload, X, Superscript as SuperscriptIcon,
  Scissors, Subscript as SubscriptIcon, Type, Pilcrow, RemoveFormatting, FilePlus2 as PagePlus, Trash2,
} from 'lucide-react'

type Margins = { left: number; right: number; top: number; bottom: number }
type SavedDoc = { title: string; content: string; updatedAt: number; margins?: Margins; paperSize?: string }
const STORAGE_KEY = 'wordpad-documents-v1'
const STARTER = '<h1>Bem-vindo ao Wordpad</h1><p>Seu editor privado e offline. Comece a escrever aqui.</p><p>Use a faixa de ferramentas para formatar ou abra um documento do computador.</p>'
const PAPER_SIZES = {
  A4: { label: 'A4 · 210 × 297 mm', width: 210, height: 297 },
  Letter: { label: 'Carta · 216 × 279 mm', width: 215.9, height: 279.4 },
  Legal: { label: 'Ofício / Legal · 216 × 356 mm', width: 215.9, height: 355.6 },
  A3: { label: 'A3 · 297 × 420 mm', width: 297, height: 420 },
  A5: { label: 'A5 · 148 × 210 mm', width: 148, height: 210 },
} as const
type PaperSize = keyof typeof PAPER_SIZES
const DOCX_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Caption'] => p:fresh",
]
const PAGE_GAP = 24
const FONT_COLORS = ['#202124', '#5f6368', '#d93025', '#ea4335', '#f29900', '#fbbc04', '#188038', '#34a853', '#007b83', '#12a5a5', '#1a73e8', '#4285f4', '#174ea6', '#673ab7', '#a142f4', '#c5221f']
const readDocs = (): SavedDoc[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SavedDoc[] } catch { return [] } }
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
type EditorNode = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: EditorNode[] }
async function prepareDocxImages(nodes: EditorNode[]): Promise<EditorNode[]> {
  return Promise.all(nodes.map(async node => {
    let next = node
    const src = String(node.attrs?.src || '')
    if (node.type === 'image' && src.startsWith('data:image/webp;base64,')) {
      next = await new Promise<EditorNode>(resolve => {
        const image = new window.Image()
        image.onload = () => {
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
          canvas.getContext('2d')?.drawImage(image, 0, 0)
          resolve({ ...node, attrs: { ...node.attrs, src: canvas.toDataURL('image/jpeg', 0.9), width: image.naturalWidth, height: image.naturalHeight } })
        }
        image.onerror = () => resolve(node)
        image.src = src
      })
    }
    return { ...next, content: next.content ? await prepareDocxImages(next.content) : undefined }
  }))
}
function inlineRuns(nodes: EditorNode[] = []): ParagraphChild[] {
  return nodes.flatMap<ParagraphChild>(node => {
    if (node.type === 'image') {
      const src = String(node.attrs?.src || '')
      const match = src.match(/^data:image\/(jpeg|jpg|png|gif|bmp);base64,(.+)$/)
      if (!match) return [new TextRun({ text: String(node.attrs?.alt || '[Imagem]') })]
      const naturalW = Number(node.attrs?.width) || 500, naturalH = Number(node.attrs?.height) || 350
      const scale = Math.min(1, 570 / naturalW, 720 / naturalH)
      return [new ImageRun({ type: match[1] === 'jpeg' ? 'jpg' : match[1] as 'jpg' | 'png' | 'gif' | 'bmp', data: Uint8Array.from(atob(match[2]), char => char.charCodeAt(0)), transformation: { width: Math.round(naturalW * scale), height: Math.round(naturalH * scale) } })]
    }
    if (node.type === 'hardBreak') return [new TextRun({ text: '', break: 1 })]
    if (node.type !== 'text') return []
    const marks = node.marks || []
    const mark = (type: string) => marks.find(item => item.type === type)
    const style = mark('textStyle')?.attrs || {}
    const color = String(style.color || '').replace('#', '').toUpperCase()
    const highlight = mark('highlight')?.attrs?.color
    const highlightHex = typeof highlight === 'string' ? highlight.replace('#', '').toUpperCase() : undefined
    const pt = Number.parseFloat(String(style.fontSize || ''))
    // Word's built-in Heading 1 style is blue by default. Write the editor's
    // dark text color explicitly when no color mark exists so DOCX theme styles
    // cannot change the appearance of the untouched starter heading.
    const textRun = new TextRun({ text: node.text || '', bold: !!mark('bold'), italics: !!mark('italic'), underline: mark('underline') ? {} : undefined, strike: !!mark('strike'), subScript: !!mark('subscript'), superScript: !!mark('superscript'), color: color || '202124', shading: highlightHex ? { fill: highlightHex } : undefined, size: Number.isFinite(pt) && pt > 0 ? Math.round(pt * 2) : undefined, font: typeof style.fontFamily === 'string' ? style.fontFamily.replaceAll('"', '') : undefined })
    const href = mark('link')?.attrs?.href
    return href ? [new ExternalHyperlink({ link: String(href), children: [textRun] })] : [textRun]
  })
}
function docxBlocks(node: EditorNode, list?: 'bullet' | 'number'): (Paragraph | DocxTable)[] {
  const content = node.content || []
  if (node.type === 'bulletList' || node.type === 'orderedList') return content.flatMap(item => docxBlocks(item, node.type === 'bulletList' ? 'bullet' : 'number'))
  if (node.type === 'listItem') {
    const continuation = Boolean(node.attrs?.paginationContinuation)
    return content.flatMap(item => item.type === 'paragraph' ? [new Paragraph({ children: inlineRuns(item.content), bullet: !continuation && list === 'bullet' ? { level: 0 } : undefined, numbering: !continuation && list === 'number' ? { reference: 'wordpad-numbering', level: 0 } : undefined })] : docxBlocks(item, list))
  }
  if (node.type === 'table') {
    const rows = content.map(row => {
      const cells = (row.content || []).map(cell => new DocxTableCell({
        children: (cell.content || []).map(paragraph => new Paragraph({ children: inlineRuns(paragraph.content), spacing: { after: 160, line: 396, lineRule: LineRuleType.AUTO } })),
        shading: cell.type === 'tableHeader' ? { fill: 'E8EFF8' } : (typeof cell.attrs?.docxCellStyle === 'string' ? { fill: cell.attrs.docxCellStyle.replace('#', '').toUpperCase() } : undefined),
        margins: { top: 90, bottom: 90, left: 110, right: 110 },
        borders: Object.fromEntries(['top', 'bottom', 'left', 'right'].map(edge => [edge, { style: BorderStyle.SINGLE, size: 4, color: '9AA6B5' }])) as never,
      }))
      return new DocxTableRow({ children: cells })
    })
    return [new DocxTable({ rows })]
  }
  if (node.type === 'pageBreak') return [new Paragraph({ pageBreakBefore: true })]
  if (node.type === 'horizontalRule') return [new Paragraph({ border: { bottom: { color: 'AEB8C4', size: 4, style: 'single' } } })]
  if (node.type === 'blockquote') return content.flatMap(child => docxBlocks(child))
  if (node.type === 'image') return [new Paragraph({ children: inlineRuns([node]), alignment: node.attrs?.align === 'left' ? AlignmentType.LEFT : node.attrs?.align === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER })]
  if (['paragraph', 'heading', 'codeBlock'].includes(node.type || '')) {
    const alignment = node.attrs?.textAlign === 'center' ? AlignmentType.CENTER : node.attrs?.textAlign === 'right' ? AlignmentType.RIGHT : node.attrs?.textAlign === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT
    const layout = typeof node.attrs?.docxLayout === 'string' ? node.attrs.docxLayout : ''
    const css = Object.fromEntries(layout.split(';').map(part => part.split(':').map(value => value.trim())).filter(pair => pair.length === 2))
    const px = (key: string) => { const value = Number.parseFloat(String(css[key] || '')); return Number.isFinite(value) ? Math.round(value * 15) : undefined }
    const line = String(css['line-height'] || '')
    const lineValue = Number.parseFloat(line)
    const spacing = { before: px('margin-top'), after: px('margin-bottom') ?? (node.type === 'heading' ? 120 : 240), line: line && Number.isFinite(lineValue) ? Math.round(line.endsWith('px') ? lineValue * 15 : lineValue * 240) : 396, lineRule: line.endsWith('px') ? LineRuleType.EXACT : LineRuleType.AUTO }
    const indent = { left: px('margin-left'), right: px('margin-right'), firstLine: px('text-indent') && px('text-indent')! > 0 ? px('text-indent') : undefined, hanging: px('text-indent') && px('text-indent')! < 0 ? Math.abs(px('text-indent')!) : undefined }
    return [new Paragraph({ children: inlineRuns(content), alignment, indent, heading: node.type === 'heading' ? (node.attrs?.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2) : undefined, spacing, widowControl: true })]
  }
  return content.flatMap(child => docxBlocks(child, list))
}

async function readDocxPageSetup(arrayBuffer: ArrayBuffer): Promise<{ paperSize: PaperSize; margins: Margins }> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const xml = await zip.file('word/document.xml')?.async('text')
  if (!xml) throw new Error('DOCX sem word/document.xml')
  const documentXml = new DOMParser().parseFromString(xml, 'application/xml')
  const sections = Array.from(documentXml.getElementsByTagNameNS('*', 'sectPr'))
  const section = sections.at(-1)
  const size = section?.getElementsByTagNameNS('*', 'pgSz').item(0)
  const margin = section?.getElementsByTagNameNS('*', 'pgMar').item(0)
  const widthMm = Number(size?.getAttribute('w:w')) / 1440 * 25.4
  const heightMm = Number(size?.getAttribute('w:h')) / 1440 * 25.4
  const candidates = Object.entries(PAPER_SIZES).map(([key, paper]) => ({ key: key as PaperSize, distance: Math.abs(paper.width - widthMm) + Math.abs(paper.height - heightMm) }))
  const paperSize = candidates.sort((a, b) => a.distance - b.distance)[0]?.key || 'A4'
  const toInches = (value: string | null, fallback: number) => value ? Math.max(0.35, Math.min(3.2, Number(value) / 1440)) : fallback
  return { paperSize, margins: { left: toInches(margin?.getAttribute('w:left') || null, 1), right: toInches(margin?.getAttribute('w:right') || null, 1), top: toInches(margin?.getAttribute('w:top') || null, 1), bottom: toInches(margin?.getAttribute('w:bottom') || null, 1) } }
}
function findTextSplitPosition(editor: Editor, element: HTMLElement, cutoffY: number, blockStart: number, blockEnd: number): { pos: number; top: number; firstTop: number } | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let textNode: globalThis.Node | null
  let firstTop: number | null = null
  while ((textNode = walker.nextNode())) {
    const text = textNode.textContent || ''
    for (let offset = 0; offset < text.length; offset++) {
      const range = document.createRange()
      range.setStart(textNode, offset); range.setEnd(textNode, offset + 1)
      const rect = range.getBoundingClientRect()
      if (firstTop === null && rect.height) firstTop = rect.top
      // Split before the first glyph that touches the page's bottom limit so a
      // whole text line can never spill into the gray inter-page gap.
      if (rect.height && rect.bottom > cutoffY) {
        const pos = editor.view.posAtDOM(textNode, offset, 1)
        // Keep the break at a legal textblock boundary. The first glyph may be
        // too tall for the remaining page space, in which case the caller will
        // move the paragraph instead of creating an empty fragment.
        if (pos > blockStart + 1 && pos < blockEnd - 1) return { pos, top: rect.top, firstTop: firstTop ?? rect.top }
        return null
      }
    }
  }
  return null
}

function pageBreakHeightToPage(articleTop: number, pitch: number, topMargin: number, boundaryY: number, offset = 0, extraPages = 0, priorBreakHeight = 0): number {
  // The logical `pages` counter can get ahead of the rendered document when a
  // long block is split and immediately reflowed. Base the destination on the
  // block's physical DOM position instead, so spacer heights never accumulate
  // from a stale page count.
  const shiftedBoundaryY = boundaryY + priorBreakHeight
  const currentPage = Math.max(0, Math.floor((shiftedBoundaryY - articleTop - topMargin) / pitch))
  const targetY = articleTop + (currentPage + 1 + extraPages) * pitch + topMargin + offset
  return Math.max(PAGE_GAP, targetY - boundaryY - priorBreakHeight)
}

function paginateDocument(editor: Editor, pageHeight: number, pageWidth: number, topMargin: number, rightMargin: number, bottomMargin: number, leftMargin: number, paginating: { current: boolean }, requestReflow: () => void): number {
  const automatic = editor.state.schema.nodes.pageBreak
  if (!automatic) return 1
  const oldAuto: { pos: number; size: number }[] = []
  // ProseMirror's forEach offset is already the position before each top-level node.
  // Adding one here places a break inside the preceding block and causes text to
  // flow into the visual page gap instead of starting on the next sheet.
  editor.state.doc.forEach((node, offset) => { if (node.type === automatic && node.attrs.automatic) oldAuto.push({ pos: offset, size: node.nodeSize }) })
  if (oldAuto.length) {
    let tr = editor.state.tr
    for (const item of oldAuto.reverse()) tr = tr.delete(item.pos, item.pos + item.size)
    tr.setMeta('addToHistory', false)
    paginating.current = true
    try { editor.view.dispatch(tr) } finally { paginating.current = false }
  }
  const state = editor.state
  const usable = Math.max(80, pageHeight - topMargin - bottomMargin)
  const articleTop = editor.view.dom.closest('article')?.getBoundingClientRect().top || 0
  const usableWidth = Math.max(80, pageWidth - leftMargin - rightMargin)
  const maxImageWidth = Math.max(40, usableWidth - 24)
  const maxImageHeight = Math.max(30, usable - 24)
  const pitch = pageHeight + PAGE_GAP
  let used = 0, pages = 1
  const insertions: { pos: number; height: number }[] = []
  const splits: { pos: number; splitHeight: number }[] = []
  const listSplits: { pos: number; splitHeight: number; nextStart?: number }[] = []
  const listTextSplits: { pos: number; listPos: number; listType: string; continuationStart: number; splitHeight: number; startBreakHeight?: number }[] = []
  const manualUpdates: { pos: number; attrs: Record<string, unknown>; height: number }[] = []
  const imageUpdates: { pos: number; attrs: Record<string, unknown> }[] = []
  const blockBreak = state.schema.nodes.pageBreak
  let requiresReflow = false
  // All measurements below use the current DOM, before this pass's structural
  // transaction is dispatched. Earlier planned separators therefore shift the
  // measured DOM boundary when they are inserted; subtract those pending
  // heights when sizing a later separator in the same transaction.
  const pendingShiftBefore = (at: number) => insertions.reduce((sum, item) => sum + (item.pos < at ? item.height : 0), 0)
  state.doc.forEach((node, offset, index) => {
    if (requiresReflow) return
    const pos = offset
    if (node.type === blockBreak) {
      const height = Math.max(PAGE_GAP, pitch - used)
      if (Math.abs(Number(node.attrs.height || 0) - height) > 1) manualUpdates.push({ pos, attrs: node.attrs, height })
      used = 0; pages++; return
    }
    const dom = editor.view.dom.children[index]
    if (node.type.name === 'image') {
      const imageDom = dom instanceof HTMLElement ? dom.querySelector('img') : null
      const currentWidth = Number(node.attrs.width) || imageDom?.naturalWidth || imageDom?.getBoundingClientRect().width || 320
      const currentHeight = Number(node.attrs.height) || imageDom?.naturalHeight || imageDom?.getBoundingClientRect().height || currentWidth
      const scale = Math.min(1, maxImageWidth / currentWidth, maxImageHeight / currentHeight)
      if (scale < 0.999) {
        imageUpdates.push({ pos, attrs: { ...node.attrs, width: Math.max(40, Math.floor(currentWidth * scale)), height: Math.max(30, Math.floor(currentHeight * scale)) } })
        requiresReflow = true
        return
      }
    }
    let blockHeight = 0
    if (dom instanceof HTMLElement) {
      const style = getComputedStyle(dom)
      const marginTop = Number.parseFloat(style.marginTop) || 0, marginBottom = Number.parseFloat(style.marginBottom) || 0
      blockHeight = dom.getBoundingClientRect().height + marginTop + marginBottom
    }
    if (!blockHeight) return
    const usedBeforeBlock = used
    const overflowsPage = used + blockHeight > usable
    const startsNewPage = used > 0 && overflowsPage
    if (node.type.name === 'paragraph' && overflowsPage) {
      const marginTop = dom instanceof HTMLElement ? Number.parseFloat(getComputedStyle(dom).marginTop) || 0 : 0
      const marginBottom = dom instanceof HTMLElement ? Number.parseFloat(getComputedStyle(dom).marginBottom) || 0 : 0
      // Split at the current page's actual remaining capacity. Previously the
      // paragraph was moved wholesale whenever it exceeded that capacity, and
      // long paragraphs were measured as if they always started at page top.
      const remaining = Math.max(0, usable - usedBeforeBlock)
      const cutoffY = (dom as HTMLElement).getBoundingClientRect().top - marginTop + remaining - marginBottom
      const textSplit = findTextSplitPosition(editor, dom as HTMLElement, cutoffY, pos, pos + node.nodeSize)
      if (textSplit !== null) {
        const paragraphTop = (dom as HTMLElement).getBoundingClientRect().top
        const paragraphMarginTop = Number.parseFloat(getComputedStyle(dom as HTMLElement).marginTop) || 0
        const firstLineOffset = paragraphMarginTop + textSplit.firstTop - paragraphTop
        splits.push({ pos: textSplit.pos, splitHeight: pageBreakHeightToPage(articleTop, pitch, topMargin, textSplit.top, firstLineOffset, 0, pendingShiftBefore(pos)) })
        pages++
        used = 0
        requiresReflow = true
        return
      }
    }
    if ((node.type.name === 'bulletList' || node.type.name === 'orderedList') && overflowsPage && dom instanceof HTMLElement) {
      const style = getComputedStyle(dom)
      const marginTop = Number.parseFloat(style.marginTop) || 0
      const marginBottom = Number.parseFloat(style.marginBottom) || 0
      const pendingShift = pendingShiftBefore(pos)
      const listTop = dom.getBoundingClientRect().top
      const listItems = Array.from(dom.children).filter((item): item is HTMLElement => item instanceof HTMLElement && item.tagName === 'LI')
      const listTopAfterPendingBreaks = listTop + pendingShift
      const pageIndex = Math.max(0, Math.floor((listTopAfterPendingBreaks - articleTop - topMargin) / pitch))
      const pageTop = articleTop + pageIndex * pitch
      const pageContentTop = pageTop + topMargin
      const pageContentBottom = pageTop + pageHeight - bottomMargin
      const findListSplitAt = (limitY: number) => {
        for (let itemIndex = 0; itemIndex < node.childCount; itemIndex++) {
          const itemDom = listItems[itemIndex]
          if (itemDom && itemDom.getBoundingClientRect().bottom > limitY) return itemIndex
        }
        return -1
      }
      let cutoffY = pageContentBottom - pendingShift
      let splitAt = findListSplitAt(cutoffY)
      // If no list item fits in the current remainder, first evaluate the list
      // at the next page's real printable bottom. This avoids using the list's
      // full height as a reason to move every item when some can still remain
      // on the current page.
      const listStartsNewPage = splitAt === 0 && listTopAfterPendingBreaks > pageContentTop + 2
      let startBreakHeight = 0
      if (listStartsNewPage) {
        startBreakHeight = pageBreakHeightToPage(articleTop, pitch, topMargin, listTop, marginTop, 0, pendingShift)
        const nextPageBottom = articleTop + (pageIndex + 1) * pitch + pageHeight - bottomMargin
        cutoffY = nextPageBottom - pendingShift - startBreakHeight
        splitAt = findListSplitAt(cutoffY)
      }
      if (splitAt >= 0) {
        const itemDom = listItems[splitAt]
        const itemNode = node.child(splitAt)
        let itemPos = pos + 1
        for (let index = 0; index < splitAt; index++) itemPos += node.child(index).nodeSize
        let childPos = itemPos + 1
        if (itemDom && itemDom.getBoundingClientRect().top < cutoffY) {
          for (let childIndex = 0; childIndex < itemNode.childCount; childIndex++) {
            const childNode = itemNode.child(childIndex)
            const childDom = itemDom.children[childIndex]
            if (['paragraph', 'heading'].includes(childNode.type.name) && childDom instanceof HTMLElement && childDom.getBoundingClientRect().bottom > cutoffY) {
              const textSplit = findTextSplitPosition(editor, childDom, cutoffY, childPos, childPos + childNode.nodeSize)
              if (textSplit !== null) {
                const listMarginTop = Number.parseFloat(style.marginTop) || 0
                const itemMarginTop = Number.parseFloat(getComputedStyle(itemDom).marginTop) || 0
                const paragraphTop = childDom.getBoundingClientRect().top
                const paragraphMarginTop = Number.parseFloat(getComputedStyle(childDom).marginTop) || 0
                const lineOffset = listMarginTop + itemMarginTop + paragraphMarginTop + textSplit.firstTop - paragraphTop
                const splitSpacer = pageBreakHeightToPage(articleTop, pitch, topMargin, textSplit.top, lineOffset, listStartsNewPage ? 1 : 0, pendingShift + startBreakHeight)
                listTextSplits.push({ pos: textSplit.pos, listPos: pos, listType: node.type.name, continuationStart: Number(node.attrs.start || 1) + splitAt, splitHeight: splitSpacer, startBreakHeight: listStartsNewPage ? startBreakHeight : undefined })
                pages += listStartsNewPage ? 2 : 1
                used = 0
                requiresReflow = true
                return
              }
              break
            }
            childPos += childNode.nodeSize
          }
        }
      }
      // Split the list between items so entries that fit remain on the current
      // sheet. If the list itself must first move to a fresh sheet, account for
      // that break as well, then let a reflow paginate the remaining items.
      if (splitAt > 0) {
        let splitPos = pos + 1
        for (let itemIndex = 0; itemIndex < splitAt; itemIndex++) splitPos += node.child(itemIndex).nodeSize
        const firstContinuationItem = listItems[splitAt]
        const listMarginTop = Number.parseFloat(style.marginTop) || 0
        const itemMarginTop = firstContinuationItem ? Number.parseFloat(getComputedStyle(firstContinuationItem).marginTop) || 0 : 0
        const splitHeight = firstContinuationItem ? pageBreakHeightToPage(articleTop, pitch, topMargin, firstContinuationItem.getBoundingClientRect().top, listMarginTop + itemMarginTop, listStartsNewPage ? 1 : 0, pendingShift + startBreakHeight) : Math.max(PAGE_GAP, pitch - usable)
        listSplits.push({ pos: splitPos, splitHeight, nextStart: node.type.name === 'orderedList' ? Number(node.attrs.start || 1) + splitAt : undefined })
        if (listStartsNewPage) insertions.push({ pos, height: startBreakHeight })
        pages += listStartsNewPage ? 2 : 1
        used = 0
        requiresReflow = true
        return
      }
    }
    if (startsNewPage) {
      const marginTop = dom instanceof HTMLElement ? Number.parseFloat(getComputedStyle(dom).marginTop) || 0 : 0
      const blockTop = dom instanceof HTMLElement ? dom.getBoundingClientRect().top : articleTop
      insertions.push({ pos, height: pageBreakHeightToPage(articleTop, pitch, topMargin, blockTop, marginTop, 0, pendingShiftBefore(pos)) })
      used = 0; pages++
    }
    used += blockHeight
    if (used > usable) { const total = used; pages += Math.ceil(total / usable) - 1; used = total % usable || usable }
  })
  if (insertions.length || manualUpdates.length || imageUpdates.length || splits.length || listSplits.length || listTextSplits.length) {
    const tr = editor.state.tr
    // Attribute updates do not change document positions, so apply them before splits.
    for (const item of [...manualUpdates].sort((a, b) => b.pos - a.pos)) tr.setNodeMarkup(item.pos, undefined, { ...item.attrs, height: item.height })
    for (const item of imageUpdates.sort((a, b) => b.pos - a.pos)) tr.setNodeMarkup(item.pos, undefined, item.attrs)
    // Apply structural changes from the end of the document so earlier positions
    // remain valid while long paragraphs are split at rendered line boundaries.
    const structural = [
      ...splits.map(split => ({ pos: split.pos, kind: 'text' as const, split })),
      ...listSplits.map(listSplit => ({ pos: listSplit.pos, kind: 'list' as const, listSplit })),
      ...listTextSplits.map(listTextSplit => ({ pos: listTextSplit.pos, kind: 'list-text' as const, listTextSplit })),
      ...insertions.map(insert => ({ pos: insert.pos, kind: 'insert' as const, insert })),
    ].sort((a, b) => b.pos - a.pos)
    for (const operation of structural) {
      if (operation.kind === 'text') {
        const split = operation.split
        tr.split(split.pos)
        tr.insert(split.pos + 1, blockBreak.create({ automatic: true, height: split.splitHeight }))
        const continuationPos = split.pos + 2
        const continuation = tr.doc.nodeAt(continuationPos)
        if (continuation?.type.name === 'paragraph') tr.setNodeMarkup(continuationPos, undefined, { ...continuation.attrs, paginationContinuation: true })
      } else if (operation.kind === 'list') {
        const split = operation.listSplit
        tr.split(split.pos, 1)
        tr.insert(split.pos + 1, blockBreak.create({ automatic: true, height: split.splitHeight }))
        const continuationPos = split.pos + 2
        const continuation = tr.doc.nodeAt(continuationPos)
        if (split.nextStart !== undefined && continuation?.type.name === 'orderedList') tr.setNodeMarkup(continuationPos, undefined, { ...continuation.attrs, start: split.nextStart })
      } else if (operation.kind === 'list-text') {
        const split = operation.listTextSplit
        tr.split(split.pos, 3)
        let continuationPos = -1
        tr.doc.forEach((candidate, candidatePos) => {
          if (continuationPos < 0 && candidatePos > split.listPos && candidate.type.name === split.listType) continuationPos = candidatePos
        })
        if (continuationPos >= 0) {
          const pageBreak = blockBreak.create({ automatic: true, height: split.splitHeight })
          tr.insert(continuationPos, pageBreak)
          continuationPos += pageBreak.nodeSize
          const continuationList = tr.doc.nodeAt(continuationPos)
          if (continuationList?.type.name === 'orderedList') tr.setNodeMarkup(continuationPos, undefined, { ...continuationList.attrs, start: split.continuationStart })
          const continuationItemPos = continuationPos + 1
          const continuationItem = tr.doc.nodeAt(continuationItemPos)
          if (continuationItem?.type.name === 'listItem') tr.setNodeMarkup(continuationItemPos, undefined, { ...continuationItem.attrs, paginationContinuation: true })
          if (split.startBreakHeight !== undefined) tr.insert(split.listPos, blockBreak.create({ automatic: true, height: split.startBreakHeight }))
        }
      } else {
        tr.insert(operation.pos, blockBreak.create({ automatic: true, height: operation.insert.height }))
      }
    }
    tr.setMeta('addToHistory', false)
    paginating.current = true
    try { editor.view.dispatch(tr) } finally { paginating.current = false }
    if (imageUpdates.length || splits.length || listSplits.length || listTextSplits.length) requestReflow()
  }
  return pages
}

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() { return [{ types: ['textStyle'], attributes: { fontSize: { default: null, parseHTML: element => element.style.fontSize || null, renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {} } } }] },
})

const PaginationContinuation = Extension.create({
  name: 'paginationContinuation',
  addGlobalAttributes() { return [{ types: ['paragraph'], attributes: { paginationContinuation: { default: false, parseHTML: element => element.hasAttribute('data-pagination-continuation'), renderHTML: attrs => attrs.paginationContinuation ? { 'data-pagination-continuation': 'true' } : {} } } }] },
})

const ListItemPaginationContinuation = Extension.create({
  name: 'listItemPaginationContinuation',
  addGlobalAttributes() { return [{ types: ['listItem'], attributes: { paginationContinuation: { default: false, parseHTML: element => element.hasAttribute('data-pagination-continuation'), renderHTML: attrs => attrs.paginationContinuation ? { 'data-pagination-continuation': 'true' } : {} } } }] },
})

const ParagraphLayout = Extension.create({
  name: 'paragraphLayout',
  addGlobalAttributes() { return [{ types: ['paragraph', 'heading'], attributes: { docxLayout: { default: null, parseHTML: element => ['margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'text-indent', 'line-height'].map(key => { const value = (element as HTMLElement).style.getPropertyValue(key); return value ? `${key}:${value}` : '' }).filter(Boolean).join(';') || null, renderHTML: attrs => attrs.docxLayout ? { style: attrs.docxLayout } : {} } } }] },
})

const TableAppearance = Extension.create({
  name: 'tableAppearance',
  addGlobalAttributes() { return [{ types: ['tableCell', 'tableHeader'], attributes: { docxCellStyle: { default: null, parseHTML: element => { const color = element.getAttribute('style')?.match(/background-color:\s*(#[\da-f]{6})/i)?.[1]; return color || null }, renderHTML: attrs => attrs.docxCellStyle ? { style: `background-color:${attrs.docxCellStyle}` } : {} } } }] },
})

const PageBreak = Node.create({
  name: 'pageBreak', group: 'block', atom: true, selectable: true,
  parseHTML() { return [{ tag: 'div[data-page-break]' }] },
  addAttributes() {
    return {
      automatic: { default: false, parseHTML: element => element.hasAttribute('data-auto-page-break'), renderHTML: attrs => attrs.automatic ? { 'data-auto-page-break': 'true' } : {} },
      height: { default: 48, parseHTML: element => Number(element.getAttribute('data-break-height')) || 48, renderHTML: attrs => ({ 'data-break-height': String(attrs.height), style: `height:${attrs.height}px` }) },
    }
  },
  renderHTML({ HTMLAttributes }) { return ['div', { ...HTMLAttributes, 'data-page-break': 'true', class: 'page-break' }] },
  addKeyboardShortcuts() { return { 'Mod-Enter': () => this.editor.commands.insertContent({ type: this.name }) } },
})

function EditableImageView({ node, selected, editor, getPos, updateAttributes }: NodeViewProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ handle: string; x: number; y: number; width: number; height: number } | null>(null)
  const beginResize = (event: React.PointerEvent<HTMLButtonElement>, handle: string) => {
    event.preventDefault(); event.stopPropagation()
    const position = getPos()
    if (typeof position === 'number') editor.commands.setNodeSelection(position)
    const rect = imageRef.current?.getBoundingClientRect()
    const width = Number(node.attrs.width) || rect?.width || 320
    const height = Number(node.attrs.height) || rect?.height || width
    drag.current = { handle, x: event.clientX, y: event.clientY, width, height }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    if (!start) return
    event.preventDefault(); event.stopPropagation()
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    const horizontal = start.handle.includes('e') ? dx : start.handle.includes('w') ? -dx : 0
    const vertical = start.handle.includes('s') ? dy : start.handle.includes('n') ? -dy : 0
    const width = Math.max(40, Math.min(2400, Math.round(start.width + horizontal)))
    const height = Math.max(30, Math.min(2400, Math.round(start.height + vertical)))
    updateAttributes({ width, height })
  }
  const stopResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const wrap = node.attrs.wrap || 'none'
  return <NodeViewWrapper as="div" contentEditable={false} className={`editor-image-node image-align-${node.attrs.align || 'center'} image-wrap-${wrap} ${selected ? 'is-selected' : ''}`} data-align={node.attrs.align || 'center'} data-wrap={wrap}>
    <img ref={imageRef} src={node.attrs.src} alt={node.attrs.alt || ''} width={node.attrs.width || undefined} height={node.attrs.height || undefined} style={{ width: node.attrs.width ? `${node.attrs.width}px` : undefined, height: node.attrs.height ? `${node.attrs.height}px` : 'auto' }} draggable={false} />
    {selected && <div className="image-resize-handles">{['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => <button key={handle} type="button" className={`image-resize-handle ${handle}`} aria-label={`Redimensionar imagem ${handle}`} onPointerDown={event => beginResize(event, handle)} onPointerMove={moveResize} onPointerUp={stopResize} onPointerCancel={stopResize} />)}</div>}
  </NodeViewWrapper>
}

const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute('width'), renderHTML: (attrs: Record<string, unknown>) => attrs.width ? { width: attrs.width, style: `width:${attrs.width}px` } : {} },
      height: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute('height'), renderHTML: (attrs: Record<string, unknown>) => attrs.height ? { height: attrs.height, style: `height:${attrs.height}px` } : {} },
      align: { default: 'center', parseHTML: (element: HTMLElement) => element.getAttribute('data-align') || 'center', renderHTML: (attrs: Record<string, unknown>) => ({ 'data-align': attrs.align || 'center' }) },
      wrap: { default: 'none', parseHTML: (element: HTMLElement) => element.getAttribute('data-wrap') || 'none', renderHTML: (attrs: Record<string, unknown>) => ({ 'data-wrap': attrs.wrap || 'none' }) },
    }
  },
  addNodeView() { return ReactNodeViewRenderer(EditableImageView) },
})

function compressImage(file: File): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new window.Image()
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (context) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height) }
      URL.revokeObjectURL(url); resolve({ src: canvas.toDataURL('image/jpeg', 0.84), width: canvas.width, height: canvas.height })
    }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler esta imagem.')) }
    image.src = url
  })
}

export default function App() {
  const [title, setTitle] = useState('Documento sem título')
  const [savedDocs, setSavedDocs] = useState<SavedDoc[]>(readDocs)
  const [status, setStatus] = useState('Salvo neste dispositivo')
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 561px)').matches)
  const [pageCount, setPageCount] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [paperSize, setPaperSize] = useState<PaperSize>('A4')
  const [contentRevision, setContentRevision] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ left: number; top: number } | null>(null)
  const [fontPaletteOpen, setFontPaletteOpen] = useState(false)
  const [fontColor, setFontColor] = useState('#202124')
  const [openInsertMenu, setOpenInsertMenu] = useState<string | null>(null)
  const [tableHover, setTableHover] = useState({ rows: 3, cols: 3 })
  const [colorMenuPosition, setColorMenuPosition] = useState({ top: 0, left: 0 })
  const [insertMenuPosition, setInsertMenuPosition] = useState({ top: 0, left: 0 })
  const [tab, setTab] = useState<'home' | 'insert' | 'layout'>('home')
  const [margins, setMargins] = useState<Margins>({ left: 1, right: 1, top: 1, bottom: 1 })
  const fileInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const fontColorButton = useRef<HTMLButtonElement>(null)
  const horizontalRuler = useRef<HTMLDivElement>(null)
  const verticalRuler = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const sidebarToggleRef = useRef<HTMLButtonElement>(null)
  const paginationInProgress = useRef(false)
  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, FontSize, FontFamily, PaginationContinuation, ListItemPaginationContinuation, ParagraphLayout, TableAppearance, Color, Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }), DocumentImage.configure({ inline: false, allowBase64: true }), PageBreak,
      Link.configure({ openOnClick: false, autolink: true, protocols: ['mailto', 'tel'] }), Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell, Subscript, Superscript],
    content: STARTER, editorProps: {
      attributes: { class: 'document-editor', spellcheck: 'true' },
      handleKeyDown: (view, event) => {
        if (event.key !== 'Tab' || event.shiftKey) return false
        const { $from } = view.state.selection
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === 'table') return false
        }
        event.preventDefault()
        view.dispatch(view.state.tr.insertText('\t'))
        return true
      },
    },
    onUpdate: ({ editor: instance }) => { if (paginationInProgress.current) return; setStatus('Alterações não salvas'); setContentRevision(value => value + 1); let count = 0; instance.state.doc.descendants(node => { if (node.type.name === 'pageBreak') count++ }); setPageCount(count + 1) },
    onSelectionUpdate: ({ editor: instance }) => { let page = 1; const cursor = instance.state.selection.from; instance.state.doc.descendants((node, position) => { if (node.type.name === 'pageBreak' && position < cursor) page++ }); setCurrentPage(page) },
  })

  const save = useCallback(() => {
    if (!editor) return
    const doc = { title: title || 'Documento sem título', content: editor.getHTML(), updatedAt: Date.now(), margins, paperSize }
    const next = [doc, ...readDocs().filter(item => item.title !== doc.title)].slice(0, 30)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSavedDocs(next); setStatus('Salvo neste dispositivo') }
    catch { setStatus('Armazenamento local cheio. Exporte uma cópia do documento.') }
  }, [editor, title, margins, paperSize])
  useEffect(() => { if (status !== 'Alterações não salvas') return; const timer = window.setTimeout(save, 900); return () => window.clearTimeout(timer) }, [status, save])
  useEffect(() => {
    if (!helpOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setHelpOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [helpOpen])
  useEffect(() => {
    if (!contextMenu) return
    const positionMenu = () => {
      const menu = contextMenuRef.current
      if (!menu) return
      const bounds = menu.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportWidth = viewport?.width || document.documentElement.clientWidth
      const viewportHeight = viewport?.height || document.documentElement.clientHeight
      const left = Math.max(8, Math.min(contextMenu.left, viewportWidth - bounds.width - 8))
      const top = Math.max(8, Math.min(contextMenu.top, viewportHeight - bounds.height - 8))
      if (Math.abs(left - contextMenu.left) > 1 || Math.abs(top - contextMenu.top) > 1) setContextMenu({ left, top })
    }
    const frame = requestAnimationFrame(positionMenu)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', positionMenu)
    window.addEventListener('resize', positionMenu)
    const closeOutside = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as globalThis.Node)) setContextMenu(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setContextMenu(null); editor?.commands.focus() }
    }
    document.addEventListener('pointerdown', closeOutside)
    window.addEventListener('keydown', closeOnEscape)
    requestAnimationFrame(() => contextMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus())
    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', positionMenu)
      window.removeEventListener('resize', positionMenu)
      document.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [contextMenu, editor])
  const paper = PAPER_SIZES[paperSize]
  const paperWidth = paper.width / 25.4 * 96
  const paperHeight = paper.height / 25.4 * 96
  const paperWidthInches = paper.width / 25.4
  const paperHeightInches = paper.height / 25.4
  const pagePitch = paperHeight + PAGE_GAP
  const pageStackHeight = Math.max(paperHeight, pageCount * pagePitch - PAGE_GAP)
  useEffect(() => {
    if (!editor) return
    const frame = requestAnimationFrame(() => setPageCount(paginateDocument(editor, paperHeight, paperWidth, margins.top * 96, margins.right * 96, margins.bottom * 96, margins.left * 96, paginationInProgress, () => setContentRevision(value => value + 1))))
    return () => cancelAnimationFrame(frame)
  }, [editor, contentRevision, paperHeight, paperWidth, margins.left, margins.right, margins.top, margins.bottom])

  const newDocument = () => { setTitle('Documento sem título'); setPaperSize('A4'); setMargins({ left: 1, right: 1, top: 1, bottom: 1 }); editor?.commands.setContent(STARTER, true); setStatus('Novo documento'); if (window.matchMedia('(max-width: 560px)').matches) setSidebarOpen(false) }
  const deleteSavedDocument = (doc: SavedDoc) => {
    if (!window.confirm(`Excluir “${doc.title}” do armazenamento local deste navegador?`)) return
    try {
      const next = readDocs().filter(saved => saved.title !== doc.title)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setSavedDocs(next)
      setStatus(doc.title === title ? 'Documento removido localmente; ainda está aberto' : 'Documento excluído deste dispositivo')
    } catch {
      setStatus('Não foi possível excluir o documento do armazenamento local')
    }
  }
  const openFile = async (file?: File) => {
    if (!file || !editor) return
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let html: string
      let importStatus = ''
      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer()
        const layout = await readDocxPageSetup(arrayBuffer)
        try { html = await convertDocxToEditableHtml(file); importStatus = 'DOCX aberto' }
        catch {
          const converted = await mammoth.convertToHtml({ arrayBuffer }, {
            styleMap: DOCX_STYLE_MAP,
            includeDefaultStyleMap: true,
            includeEmbeddedStyleMap: true,
            convertImage: mammoth.images.imgElement(async image => ({ src: `data:${image.contentType};base64,${await image.readAsBase64String()}` })),
          })
          html = converted.value
          const warningCount = converted.messages.filter(message => message.type === 'warning').length
          importStatus = warningCount ? `DOCX aberto com ${warningCount} aviso(s) de conversão` : 'DOCX aberto'
        }
        setPaperSize(layout.paperSize); setMargins(layout.margins)
      }
      else if (ext === 'html' || ext === 'htm') html = await file.text()
      else html = (await file.text()).split(/\r?\n/).map(line => `<p>${escapeHtml(line)}</p>`).join('')
      editor.commands.setContent(html || '<p></p>', true); setTitle(file.name.replace(/\.[^.]+$/, '')); setStatus(importStatus || `Arquivo aberto: ${file.name}`)
    } catch { setStatus('Não foi possível abrir este arquivo') }
    if (fileInput.current) fileInput.current.value = ''
  }
  const insertImage = async (file?: File) => {
    if (!file || !editor) return
    try { const image = await compressImage(file); editor.chain().focus().setImage({ ...image, alt: file.name }).run() }
    catch { setStatus('Não foi possível inserir a imagem') }
    if (imageInput.current) imageInput.current.value = ''
  }
  const addLink = () => {
    const previous = editor?.getAttributes('link').href as string | undefined
    const url = window.prompt('Endereço do link (URL)', previous || 'https://')
    if (url === null) return
    if (!url.trim()) editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor?.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }
  const insertTable = (rows = 3, cols = 3) => { editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run(); setOpenInsertMenu(null) }
  const resizeSelectedImage = (newWidth: number) => {
    if (!editor || !Number.isFinite(newWidth) || newWidth < 30) return
    const attrs = editor.getAttributes('image')
    const dom = editor.view.nodeDOM(editor.state.selection.from) as HTMLImageElement | null
    const oldWidth = Number(attrs.width) || dom?.width || dom?.naturalWidth || newWidth
    const oldHeight = Number(attrs.height) || dom?.height || dom?.naturalHeight || oldWidth
    editor.chain().focus().updateAttributes('image', { width: Math.round(newWidth), height: Math.round(oldHeight * newWidth / oldWidth) }).run()
  }
  const applyFontColor = (color: string) => { setFontColor(color); editor?.chain().focus().setColor(color).run(); setFontPaletteOpen(false) }
  const popupPosition = (element: HTMLElement | null, width: number) => {
    const rect = element?.getBoundingClientRect()
    return rect ? { top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) } : { top: 150, left: 12 }
  }
  const toggleInsertMenu = (key: string, event: React.MouseEvent<HTMLButtonElement>, width = 300) => {
    if (openInsertMenu === key) { setOpenInsertMenu(null); return }
    setInsertMenuPosition(popupPosition(event.currentTarget, width))
    setOpenInsertMenu(key)
  }
  const insertPageBreak = () => { editor?.chain().focus().insertContent({ type: 'pageBreak' }).run(); setOpenInsertMenu(null) }
  const copyFromEditor = async (removeSelection = false) => {
    const selection = editor?.state.selection
    if (!editor || !selection || selection.empty) return
    const text = editor.state.doc.textBetween(selection.from, selection.to, '\n')
    editor.commands.focus()
    if (document.execCommand(removeSelection ? 'cut' : 'copy')) return
    try {
      await navigator.clipboard.writeText(text)
      if (removeSelection) editor.chain().focus().deleteSelection().run()
    } catch {
      setStatus('Use o atalho de teclado para copiar ou recortar neste navegador.')
    }
  }
  const pasteIntoEditor = async () => {
    if (!editor) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) editor.chain().focus().insertContent({ type: 'text', text }).run()
    } catch {
      setStatus('O navegador bloqueou a área de transferência. Use Ctrl+V ou ⌘+V.')
    }
  }
  const openEditorContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    if (!editor) return
    const hit = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    const selection = editor.state.selection
    if (hit && (selection.empty || hit.pos < selection.from || hit.pos > selection.to)) {
      const nodeAtPosition = editor.state.doc.nodeAt(hit.pos)
      const nodeBeforePosition = hit.pos > 0 ? editor.state.doc.nodeAt(hit.pos - 1) : null
      const imagePos = nodeAtPosition?.type.name === 'image' ? hit.pos : nodeBeforePosition?.type.name === 'image' ? hit.pos - 1 : null
      if (imagePos !== null) editor.commands.setNodeSelection(imagePos)
      else editor.commands.setTextSelection(hit.pos)
    }
    setContextMenu({ left: event.clientX, top: event.clientY })
  }
  const download = (data: BlobPart, name: string, type: string) => saveAs(new Blob([data], { type }), name)
  const exportDocx = async () => {
    if (!editor) return
    const blocks = await prepareDocxImages(editor.getJSON().content || [])
    const children = blocks.flatMap(block => docxBlocks(block))
    const numbering = { config: [{ reference: 'wordpad-numbering', levels: [{ level: 0, format: 'decimal' as const, text: '%1.', alignment: 'start' as const, style: { paragraph: { indent: { left: 720, hanging: 260 } } } }] }] }
    const doc = new Document({ numbering, styles: { default: { document: { run: { font: 'Arial', size: 24 }, paragraph: { spacing: { after: 240, line: 396, lineRule: LineRuleType.AUTO } } } } }, sections: [{ properties: { page: { size: { width: Math.round(paper.width / 25.4 * 1440), height: Math.round(paper.height / 25.4 * 1440) }, margin: { top: Math.round(margins.top * 1440), right: Math.round(margins.right * 1440), bottom: Math.round(margins.bottom * 1440), left: Math.round(margins.left * 1440) } } }, children }] })
    download(await Packer.toBlob(doc), `${title || 'documento'}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  }
  const exportPdf = () => window.print()
  const exportText = () => download(editor?.getText() || '', `${title}.txt`, 'text/plain;charset=utf-8')
  const exportHtml = () => download(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${escapeHtml(title)}</title><body>${editor?.getHTML() || ''}</body></html>`, `${title}.html`, 'text/html;charset=utf-8')
  const exportMarkdown = () => download(editor?.getText() || '', `${title}.md`, 'text/markdown;charset=utf-8')

  const closeMobileSidebarOnOutside = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sidebarOpen || !window.matchMedia('(max-width: 560px)').matches) return
    const target = event.target
    if (!(target instanceof globalThis.Node)) return
    if (!sidebarRef.current?.contains(target) && !sidebarToggleRef.current?.contains(target)) setSidebarOpen(false)
  }

  const adjustMargin = (axis: 'horizontal' | 'vertical', side: 'left' | 'right' | 'top' | 'bottom', event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const ruler = axis === 'horizontal' ? horizontalRuler.current : verticalRuler.current
    if (!ruler) return
    const rect = ruler.getBoundingClientRect()
    const update = (e: PointerEvent) => {
      const totalInches = axis === 'horizontal' ? paperWidthInches : paperHeightInches
      const position = axis === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top
      const rulerInches = (position / (axis === 'horizontal' ? rect.width : rect.height)) * totalInches
      const value = Math.max(0.35, Math.min(3.2, side === 'right' || side === 'bottom' ? totalInches - rulerInches : rulerInches))
      setMargins(current => ({ ...current, [side]: Math.round(value * 10) / 10 })); setStatus('Alterações não salvas')
    }
    const finish = () => { window.removeEventListener('pointermove', update); window.removeEventListener('pointerup', finish) }
    window.addEventListener('pointermove', update); window.addEventListener('pointerup', finish, { once: true })
  }

  if (!editor) return null
  const Tool = ({ label, action, children, active = false }: { label: string; action: () => void; children: React.ReactNode; active?: boolean }) => <button type="button" title={label} aria-label={label} className={`tool ${active ? 'active' : ''}`} onClick={action}>{children}</button>
  const ContextItem = ({ label, icon, action, disabled = false, active = false }: { label: string; icon: React.ReactNode; action: () => void; disabled?: boolean; active?: boolean }) => <button type="button" role="menuitem" className={`context-menu-item ${active ? 'active' : ''}`} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { action(); setContextMenu(null) }}>{icon}<span>{label}</span></button>
  const fontFamily = (family: string) => editor.chain().focus().setFontFamily(family).run()
  const setFontSize = (size: string) => editor.chain().focus().setMark('textStyle', { fontSize: `${size}pt` }).run()
  const selectedImage = editor.isActive('image')
  const imageAttrs = editor.getAttributes('image')
  const selectedImageDom = selectedImage ? editor.view.nodeDOM(editor.state.selection.from) as HTMLImageElement | null : null
  const imageWidth = Number(imageAttrs.width) || selectedImageDom?.width || selectedImageDom?.naturalWidth || 320
  const maxImageWidth = Math.max(100, Math.floor(paperWidth - (margins.left + margins.right) * 96))
  const inTable = editor.isActive('table')
  const toolbar = <div className="tools">
    <div className="group"><Tool label="Desfazer" action={() => editor.chain().focus().undo().run()}><Undo2 /></Tool><Tool label="Refazer" action={() => editor.chain().focus().redo().run()}><Redo2 /></Tool></div><i />
    <select aria-label="Estilo do parágrafo" value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : 'p'} onChange={e => e.target.value === 'p' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: e.target.value === 'h1' ? 1 : 2 }).run()}><option value="p">Texto normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option></select>
    <select aria-label="Fonte" defaultValue="Arial" onChange={e => fontFamily(e.target.value)}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option><option>Verdana</option><option>Tahoma</option></select>
    <select aria-label="Tamanho da fonte" defaultValue="12" onChange={e => setFontSize(e.target.value)}>{['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '36', '48', '72'].map(size => <option key={size} value={size}>{size} pt</option>)}</select><i />
    <div className="group"><Tool label="Negrito" active={editor.isActive('bold')} action={() => editor.chain().focus().toggleBold().run()}><Bold /></Tool><Tool label="Itálico" active={editor.isActive('italic')} action={() => editor.chain().focus().toggleItalic().run()}><Italic /></Tool><Tool label="Sublinhado" active={editor.isActive('underline')} action={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon /></Tool><Tool label="Tachado" active={editor.isActive('strike')} action={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></Tool><Tool label="Sobrescrito" active={editor.isActive('superscript')} action={() => editor.chain().focus().toggleSuperscript().run()}><SuperscriptIcon /></Tool><Tool label="Subscrito" active={editor.isActive('subscript')} action={() => editor.chain().focus().toggleSubscript().run()}><SubscriptIcon /></Tool></div><i />
    <div className="color-picker"><button ref={fontColorButton} type="button" className="color-tool font-color-button" title="Aplicar cor da fonte" aria-label="Aplicar cor da fonte" onClick={() => applyFontColor(fontColor)}><Type /><span style={{ backgroundColor: fontColor }} /></button><button type="button" className="color-caret" title="Escolher cor da fonte" aria-label="Escolher cor da fonte" onClick={() => { setColorMenuPosition(popupPosition(fontColorButton.current, 210)); setFontPaletteOpen(open => !open) }}><ChevronDown size={13} /></button>{fontPaletteOpen && <div className="color-menu" style={colorMenuPosition}><strong>Cor da fonte</strong><div className="color-swatches">{FONT_COLORS.map(color => <button key={color} type="button" title={color} aria-label={`Cor ${color}`} style={{ backgroundColor: color }} onClick={() => applyFontColor(color)} />)}</div><label>Personalizada<input type="color" value={fontColor} onChange={e => { setFontColor(e.target.value); editor.chain().focus().setColor(e.target.value).run() }} /></label></div>}</div><label className="color-tool" title="Realce"><Highlighter /><input type="color" aria-label="Cor do realce" defaultValue="#fff176" onChange={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} /></label><Tool label="Remover formatação" action={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting /></Tool><i />
    <div className="group"><Tool label="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} action={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft /></Tool><Tool label="Centralizar" active={editor.isActive({ textAlign: 'center' })} action={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter /></Tool><Tool label="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} action={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight /></Tool><Tool label="Justificar" active={editor.isActive({ textAlign: 'justify' })} action={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify /></Tool></div><i />
    <div className="group"><Tool label="Lista com marcadores" active={editor.isActive('bulletList')} action={() => editor.chain().focus().toggleBulletList().run()}><List /></Tool><Tool label="Lista numerada" active={editor.isActive('orderedList')} action={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Tool><Tool label="Citação" active={editor.isActive('blockquote')} action={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Tool><Tool label="Bloco de código" active={editor.isActive('codeBlock')} action={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 /></Tool></div>
  </div>
  const insertTools = <div className="tools insert-tools">
    <div className="insert-dropdown">
      <button className={`insert-action insert-dropdown-trigger ${selectedImage ? 'active' : ''}`} onClick={event => toggleInsertMenu('image', event, 340)}><ImagePlus size={16} /> Imagem <ChevronDown size={14} /></button>
      {openInsertMenu === 'image' && <div className="insert-menu image-insert-menu" style={insertMenuPosition}>
        <strong>Imagem</strong>
        <button className="insert-menu-action" onClick={() => { setOpenInsertMenu(null); imageInput.current?.click() }}><ImagePlus size={16} /> Inserir do computador</button>
        {selectedImage ? <>
          <div className="insert-menu-section"><span>Editar imagem selecionada</span><div className="image-edit-tools">
            <label>Largura<input aria-label="Largura da imagem em pixels" type="number" min="30" max={maxImageWidth} step="10" value={Math.min(imageWidth, maxImageWidth)} onChange={e => resizeSelectedImage(Number(e.target.value))} /><span>px</span></label>
            <label className="image-alt">Texto alternativo<input aria-label="Texto alternativo da imagem" value={String(imageAttrs.alt || '')} onChange={e => editor.chain().focus().updateAttributes('image', { alt: e.target.value }).run()} /></label>
          </div></div>
          <div className="insert-menu-section"><span>Alinhamento</span><div className="insert-menu-button-row">
            <button className={`insert-action ${imageAttrs.align === 'left' ? 'active' : ''}`} title="Alinhar imagem à esquerda" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()}><AlignLeft size={15} /> Esquerda</button>
            <button className={`insert-action ${imageAttrs.align !== 'left' && imageAttrs.align !== 'right' ? 'active' : ''}`} title="Centralizar imagem" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()}><AlignCenter size={15} /> Centro</button>
            <button className={`insert-action ${imageAttrs.align === 'right' ? 'active' : ''}`} title="Alinhar imagem à direita" onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()}><AlignRight size={15} /> Direita</button>
          </div></div>
          <div className="insert-menu-section"><span>Quebra de texto</span><div className="insert-menu-button-row">
            <button className={`insert-action ${imageAttrs.wrap === 'none' ? 'active' : ''}`} title="Texto abaixo da imagem" onClick={() => editor.chain().focus().updateAttributes('image', { wrap: 'none' }).run()}>Sem quebra</button>
            <button className={`insert-action ${imageAttrs.wrap === 'left' ? 'active' : ''}`} title="Texto ao lado direito da imagem" onClick={() => editor.chain().focus().updateAttributes('image', { wrap: 'left' }).run()}>Texto à direita</button>
            <button className={`insert-action ${imageAttrs.wrap === 'right' ? 'active' : ''}`} title="Texto ao lado esquerdo da imagem" onClick={() => editor.chain().focus().updateAttributes('image', { wrap: 'right' }).run()}>Texto à esquerda</button>
          </div></div>
          <button className="insert-menu-action danger" onClick={() => { editor.chain().focus().deleteSelection().run(); setOpenInsertMenu(null) }}><X size={16} /> Remover imagem</button>
        </> : <p className="insert-menu-hint">Selecione uma imagem no documento para editar tamanho, alinhamento e quebra de texto.</p>}
      </div>}
    </div>

    <div className="insert-dropdown">
      <button className={`insert-action insert-dropdown-trigger ${editor.isActive('link') ? 'active' : ''}`} onClick={event => toggleInsertMenu('link', event, 225)}><Link2 size={16} /> Link <ChevronDown size={14} /></button>
      {openInsertMenu === 'link' && <div className="insert-menu compact-insert-menu" style={insertMenuPosition}><strong>Link</strong><button className="insert-menu-action" onClick={() => { addLink(); setOpenInsertMenu(null) }}><Link2 size={16} /> Adicionar ou editar link</button><button className="insert-menu-action" disabled={!editor.isActive('link')} onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setOpenInsertMenu(null) }}><X size={16} /> Remover link</button></div>}
    </div>

    <div className="insert-dropdown">
      <button className={`insert-action insert-dropdown-trigger ${inTable ? 'active' : ''}`} onClick={event => toggleInsertMenu('table', event, 285)}><Table2 size={16} /> Tabela <ChevronDown size={14} /></button>
      {openInsertMenu === 'table' && <div className="insert-menu table-insert-menu" style={insertMenuPosition}>
        <strong>Tabela · {tableHover.rows} × {tableHover.cols}</strong>
        <div className="table-grid-picker">{Array.from({ length: 64 }, (_, index) => { const rows = Math.floor(index / 8) + 1, cols = index % 8 + 1; const active = rows <= tableHover.rows && cols <= tableHover.cols; return <button key={index} type="button" aria-label={`Inserir tabela ${rows} por ${cols}`} className={active ? 'active' : ''} onMouseEnter={() => setTableHover({ rows, cols })} onFocus={() => setTableHover({ rows, cols })} onClick={() => insertTable(rows, cols)} /> })}</div><small>Escolha o número de linhas e colunas</small>
        <div className="insert-menu-section"><span>Editar tabela selecionada</span><div className="insert-menu-button-row table-menu-actions">
          <button className="insert-action" disabled={!inTable} title="Adicionar linha abaixo" onClick={() => editor.chain().focus().addRowAfter().run()}><Plus size={15} /> Linha</button>
          <button className="insert-action" disabled={!inTable} title="Adicionar coluna à direita" onClick={() => editor.chain().focus().addColumnAfter().run()}><Plus size={15} /> Coluna</button>
          <button className="insert-action" disabled={!inTable} title="Remover linha" onClick={() => editor.chain().focus().deleteRow().run()}><Minus size={15} /> Linha</button>
          <button className="insert-action" disabled={!inTable} title="Remover coluna" onClick={() => editor.chain().focus().deleteColumn().run()}><Minus size={15} /> Coluna</button>
          <button className="insert-action danger" disabled={!inTable} title="Excluir tabela" onClick={() => editor.chain().focus().deleteTable().run()}><X size={15} /> Excluir</button>
        </div></div>
      </div>}
    </div>

    <div className="insert-dropdown">
      <button className="insert-action insert-dropdown-trigger" onClick={event => toggleInsertMenu('more', event, 220)}><Pilcrow size={16} /> Mais <ChevronDown size={14} /></button>
      {openInsertMenu === 'more' && <div className="insert-menu compact-insert-menu" style={insertMenuPosition}><strong>Outras inserções</strong><button className="insert-menu-action" onClick={() => { editor.chain().focus().setHorizontalRule().run(); setOpenInsertMenu(null) }}><Pilcrow size={16} /> Linha horizontal</button><button className="insert-menu-action" onClick={insertPageBreak}><PagePlus size={16} /> Quebra de página</button></div>}
    </div>

    <div className="insert-dropdown">
      <button className="insert-action insert-dropdown-trigger" onClick={event => toggleInsertMenu('file', event, 225)}><Upload size={16} /> Arquivo <ChevronDown size={14} /></button>
      {openInsertMenu === 'file' && <div className="insert-menu compact-insert-menu" style={insertMenuPosition}><strong>Arquivo</strong><button className="insert-menu-action" onClick={() => { setOpenInsertMenu(null); fileInput.current?.click() }}><Upload size={16} /> Abrir documento</button><small>DOCX, HTML, Markdown ou texto</small></div>}
    </div>
  </div>

  return <div className="app" onPointerDown={closeMobileSidebarOnOutside}><style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in; }`}</style><header className="top"><div className="logo"><FileText /></div><div className="docname"><input value={title} aria-label="Nome do documento" onChange={e => setTitle(e.target.value)} onBlur={save} /><small><Check size={13} />{status}</small></div><div className="actions"><div className="drop"><button className="primary" onClick={() => setMenuOpen(!menuOpen)}><Save size={16} /> Salvar <ChevronDown size={15} /></button>{menuOpen && <div className="menu">{[['Word (.docx)', exportDocx], ['PDF / Imprimir', exportPdf], ['Texto (.txt)', exportText], ['HTML', exportHtml], ['Markdown (.md)', exportMarkdown]].map(([label, action]) => <button key={label as string} onClick={() => { (action as () => void)(); setMenuOpen(false) }}>{label as string}</button>)}</div>}</div><button type="button" className="plain help-button" onClick={() => setHelpOpen(true)} aria-label="Abrir guia de uso"><CircleHelp size={17} /> Ajuda</button></div></header>
    <nav className="ribbon"><div className="tabs"><button className={tab === 'home' ? 'selected' : ''} onClick={() => setTab('home')}>Página Inicial</button><button className={tab === 'insert' ? 'selected' : ''} onClick={() => setTab('insert')}>Inserir</button><button className={tab === 'layout' ? 'selected' : ''} onClick={() => setTab('layout')}>Layout</button></div>{tab === 'home' ? toolbar : tab === 'insert' ? insertTools : <div className="tools layout-tools"><label className="paper-size-label">Papel<select aria-label="Tamanho do papel" value={paperSize} onChange={e => { setPaperSize(e.target.value as PaperSize); setStatus('Alterações não salvas') }}>{Object.entries(PAPER_SIZES).map(([key, size]) => <option key={key} value={key}>{size.label}</option>)}</select></label><span>Margens (pol.)</span>{(['left', 'right', 'top', 'bottom'] as const).map(side => <label key={side}>{({ left: 'Esq.', right: 'Dir.', top: 'Sup.', bottom: 'Inf.' })[side]}<input type="number" min="0.35" max="3.2" step="0.1" value={margins[side]} onChange={e => { setMargins(m => ({ ...m, [side]: Number(e.target.value) })); setStatus('Alterações não salvas') }} /></label>)}<button className="insert-action" onClick={exportPdf}><Printer size={16} /> Visualizar / PDF</button></div>}</nav>
    <main><aside ref={sidebarRef} className={sidebarOpen ? '' : 'closed'}><div className="sidehead">Documentos recentes <button title="Novo documento" onClick={newDocument}><FilePlus2 /></button></div><button className="new" onClick={newDocument}><FilePlus2 /> Novo documento</button>{savedDocs.map((doc, index) => <div className="recent-row" key={`${doc.title}-${doc.updatedAt}-${index}`}><button className="recent" onClick={() => { setTitle(doc.title); setPaperSize((doc.paperSize as PaperSize) || 'Letter'); setMargins(doc.margins || { left: 1, right: 1, top: 1, bottom: 1 }); editor.commands.setContent(doc.content, true); setStatus('Documento local aberto'); if (window.matchMedia('(max-width: 560px)').matches) setSidebarOpen(false) }}><FileText /><span>{doc.title}<small>{new Date(doc.updatedAt).toLocaleDateString('pt-BR')}</small></span></button><button type="button" className="recent-delete" title={`Excluir ${doc.title}`} aria-label={`Excluir ${doc.title} do armazenamento local`} onClick={() => deleteSavedDocument(doc)}><Trash2 size={16} /></button></div>)}{savedDocs.length === 0 && <p className="empty">Os documentos locais aparecerão aqui.</p>}<div className="privacy">● Seus arquivos ficam somente neste dispositivo.</div></aside>
      <section>
        <div className="subbar"><button ref={sidebarToggleRef} type="button" className="tool" title="Mostrar/ocultar documentos" aria-label="Mostrar ou ocultar documentos recentes" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}><Menu /></button>Meus documentos　›　{title}<span>100%</span></div>
        <div className="scroll">
          <div className="page-layout" style={{ width: paperWidth + 72 }}>
            <div className="horizontal-ruler" ref={horizontalRuler} style={{ width: paperWidth }} aria-label="Régua horizontal em polegadas">
              <div className="ruler-scale" />
              {Array.from({ length: Math.floor(paperWidthInches) + 1 }, (_, inch) => <span key={inch} className="ruler-number" style={{ left: `${inch / paperWidthInches * 100}%` }}>{inch}</span>)}
              {(['left', 'right'] as const).map(side => <button key={side} className={`ruler-handle ${side}`} title={`Arraste para ajustar margem ${side === 'left' ? 'esquerda' : 'direita'}: ${margins[side]} pol.`} style={{ left: `${(side === 'left' ? margins.left : paperWidthInches - margins.right) / paperWidthInches * 100}%` }} onPointerDown={event => adjustMargin('horizontal', side, event)}><span /></button>)}
            </div>
            <div className="page-row">
              <div className="vertical-ruler" ref={verticalRuler} style={{ height: paperHeight }} aria-label="Régua vertical em polegadas">
                <div className="vertical-scale" />
                {Array.from({ length: Math.floor(paperHeightInches) + 1 }, (_, inch) => <span key={inch} className="ruler-number vertical-number" style={{ top: `${inch / paperHeightInches * 100}%` }}>{inch}</span>)}
                {(['top', 'bottom'] as const).map(side => <button key={side} className={`ruler-handle ${side}`} title={`Arraste para ajustar margem ${side === 'top' ? 'superior' : 'inferior'}: ${margins[side]} pol.`} style={{ top: `${(side === 'top' ? margins.top : paperHeightInches - margins.bottom) / paperHeightInches * 100}%` }} onPointerDown={event => adjustMargin('vertical', side, event)}><span /></button>)}
              </div>
              <article onContextMenu={openEditorContextMenu} style={{ width: paperWidth, minWidth: paperWidth, minHeight: pageStackHeight, padding: `${margins.top * 96}px ${margins.right * 96}px ${margins.bottom * 96}px ${margins.left * 96}px`, '--page-height': `${paperHeight}px`, '--page-pitch': `${pagePitch}px`, '--top-margin': `${margins.top * 96}px`, '--bottom-margin': `${margins.bottom * 96}px`, '--left-margin': `${margins.left * 96}px`, '--right-margin': `${margins.right * 96}px` } as React.CSSProperties}><EditorContent editor={editor} /></article>
            </div>
          </div>
        </div>
        <footer><span>Página {currentPage} de {pageCount}</span><span>{editor.getText().length} caracteres</span><label>Ctrl+Enter insere quebra · Salvamento local</label></footer>
      </section></main>
    <input ref={fileInput} hidden type="file" accept=".txt,.md,.markdown,.html,.htm,.docx" onChange={e => openFile(e.target.files?.[0])} /><input ref={imageInput} hidden type="file" accept="image/*" onChange={e => insertImage(e.target.files?.[0])} /><div className="mobile"><button onClick={() => fileInput.current?.click()}>Abrir</button><button onClick={exportPdf}>PDF</button><button onClick={() => setTab(tab === 'insert' ? 'home' : 'insert')}>Inserir</button></div>
    {contextMenu && <div ref={contextMenuRef} className="context-menu" role="menu" aria-label="Menu de edição" style={{ left: contextMenu.left, top: contextMenu.top }} onMouseDown={event => event.preventDefault()} onKeyDown={event => {
      if (event.key === 'Escape') { setContextMenu(null); editor.commands.focus(); return }
      if (event.key === 'Tab') { setContextMenu(null); return }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'))
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
    }}>
      <ContextItem label="Desfazer" icon={<Undo2 />} action={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
      <ContextItem label="Refazer" icon={<Redo2 />} action={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
      <div className="context-menu-separator" />
      <ContextItem label="Recortar" icon={<Scissors />} action={() => { void copyFromEditor(true) }} disabled={editor.state.selection.empty} />
      <ContextItem label="Copiar" icon={<Copy />} action={() => { void copyFromEditor() }} disabled={editor.state.selection.empty} />
      <ContextItem label="Colar" icon={<ClipboardPaste />} action={() => { void pasteIntoEditor() }} />
      <ContextItem label="Selecionar tudo" icon={<Check />} action={() => editor.chain().focus().selectAll().run()} />
      <div className="context-menu-separator" />
      <ContextItem label="Negrito" icon={<Bold />} action={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
      <ContextItem label="Itálico" icon={<Italic />} action={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
      <ContextItem label="Sublinhado" icon={<UnderlineIcon />} action={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
      <ContextItem label="Tachado" icon={<Strikethrough />} action={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
      <label className="context-color-row">Cor da fonte<input aria-label="Escolher cor da fonte" type="color" value={fontColor} onChange={event => applyFontColor(event.target.value)} /></label>
      <ContextItem label="Remover formatação" icon={<RemoveFormatting />} action={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} />
      <div className="context-menu-separator" />
      <ContextItem label="Texto normal" icon={<Type />} action={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} />
      <ContextItem label="Título 1" icon={<Type />} action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} />
      <ContextItem label="Título 2" icon={<Type />} action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} />
      <ContextItem label="Lista com marcadores" icon={<List />} action={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
      <ContextItem label="Lista numerada" icon={<ListOrdered />} action={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
      <ContextItem label="Citação" icon={<Quote />} action={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
      <div className="context-menu-separator" />
      <ContextItem label="Alinhar à esquerda" icon={<AlignLeft />} action={() => editor.chain().focus().setTextAlign('left').run()} />
      <ContextItem label="Centralizar" icon={<AlignCenter />} action={() => editor.chain().focus().setTextAlign('center').run()} />
      <ContextItem label="Alinhar à direita" icon={<AlignRight />} action={() => editor.chain().focus().setTextAlign('right').run()} />
      <ContextItem label="Justificar" icon={<AlignJustify />} action={() => editor.chain().focus().setTextAlign('justify').run()} />
      <div className="context-menu-separator" />
      <ContextItem label="Adicionar ou editar link" icon={<Link2 />} action={addLink} />
      <ContextItem label="Remover link" icon={<X />} action={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()} disabled={!editor.isActive('link')} />
      <ContextItem label="Inserir imagem" icon={<ImagePlus />} action={() => imageInput.current?.click()} />
      <ContextItem label="Inserir tabela 3 × 3" icon={<Table2 />} action={() => insertTable(3, 3)} />
      <ContextItem label="Quebra de página" icon={<PagePlus />} action={insertPageBreak} />
      {selectedImage && <ContextItem label="Remover imagem" icon={<X />} action={() => editor.chain().focus().deleteSelection().run()} />}
    </div>}
    {helpOpen && <div className="help-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setHelpOpen(false) }}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><header className="help-dialog-header"><strong id="help-title"><CircleHelp size={18} /> Guia completo de uso</strong><button type="button" className="tool" aria-label="Fechar guia" onClick={() => setHelpOpen(false)}><X size={18} /></button></header><iframe title="Guia do usuário do Wordpad" src={`${import.meta.env.BASE_URL}guia-do-usuario.html`} /></section></div>}
  </div>
}

