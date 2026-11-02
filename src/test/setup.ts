import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom implements the DOM tree but not the layout/browser APIs the editor
// probes. These stubs keep ProseMirror, the pagination effects and the image
// helpers from throwing; they do not try to emulate real geometry.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() { /* no layout in jsdom */ }
    unobserve() { /* no layout in jsdom */ }
    disconnect() { /* no layout in jsdom */ }
  }
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    root = null
    rootMargin = ''
    thresholds: number[] = []
    observe() { /* no layout in jsdom */ }
    unobserve() { /* no layout in jsdom */ }
    disconnect() { /* no layout in jsdom */ }
    takeRecords() { return [] }
  } as unknown as typeof IntersectionObserver
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined
}

// jsdom has no hit testing. ProseMirror calls elementFromPoint from its own
// mousedown handler, so a missing implementation turns every synthetic click on
// the editor into an unhandled error. Returning null lets posAtCoords fall back
// to the (empty) layout boxes instead of throwing.
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}

if (!window.scrollTo) {
  window.scrollTo = () => undefined
}

if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:wordpad-test'
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => undefined
}

// ProseMirror asks for glyph boxes when it needs coordinates. jsdom returns an
// empty list, which is enough for model-level tests but not for real geometry.
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () { /* empty */ } }) as unknown as DOMRectList
}
if (typeof Range !== 'undefined' && !Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}
