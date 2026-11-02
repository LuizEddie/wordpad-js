import { describe, expect, it } from 'vitest'
import {
  STORAGE_KEY,
  cssLengthToPt,
  cssLengthToTwips,
  cssLineHeightToTwips,
  headingGap,
  headingLineHeight,
  headingSizePt,
  isListContinuation,
  parseFontFamily,
  parseFontSizeInput,
  parseFontSizePt,
  parseLayoutDeclarations,
  readDocs,
  resolveLinkUrl,
  serializeLayoutDeclarations,
} from '../../App'

describe('parseFontSizeInput', () => {
  it('accepts integer and decimal sizes, with comma or pt suffix', () => {
    expect(parseFontSizeInput('12')).toBe(12)
    expect(parseFontSizeInput('12,5')).toBe(12.5)
    expect(parseFontSizeInput(' 14 pt ')).toBe(14)
  })

  it('clamps the value to the supported range', () => {
    expect(parseFontSizeInput('500')).toBe(400)
    expect(parseFontSizeInput('0.2')).toBe(1)
  })

  it('rejects empty, negative, unit-suffixed and non-numeric values', () => {
    expect(parseFontSizeInput('')).toBeNull()
    expect(parseFontSizeInput('0')).toBeNull()
    expect(parseFontSizeInput('-5')).toBeNull()
    expect(parseFontSizeInput('12px')).toBeNull()
    expect(parseFontSizeInput('abc')).toBeNull()
  })
})

describe('parseFontSizePt', () => {
  it('converts px and em to points', () => {
    expect(parseFontSizePt('20pt')).toBe(20)
    expect(parseFontSizePt('32px')).toBe(24)
    expect(parseFontSizePt('1.5em', 12)).toBe(18)
    expect(parseFontSizePt('2rem', 12)).toBe(24)
  })

  it('rejects invalid or non-positive values', () => {
    expect(parseFontSizePt('')).toBeUndefined()
    expect(parseFontSizePt('0')).toBeUndefined()
    expect(parseFontSizePt('abc')).toBeUndefined()
  })
})

describe('headingSizePt', () => {
  it('mirrors the h1-h6 sizes from style.css', () => {
    expect([1, 2, 3, 4, 5, 6].map(headingSizePt)).toEqual([24, 18, 14, 12, 11, 10])
  })

  it('clamps out-of-range levels', () => {
    expect(headingSizePt(0)).toBe(24)
    expect(headingSizePt(9)).toBe(10)
  })
})

describe('cssLengthToTwips', () => {
  it('converts pt, px, inches and metric units', () => {
    expect(cssLengthToTwips('1pt')).toBe(20)
    expect(cssLengthToTwips('1px')).toBe(15)
    expect(cssLengthToTwips('1in')).toBe(1440)
    expect(cssLengthToTwips('2.54cm')).toBe(1440)
    expect(cssLengthToTwips('25.4mm')).toBe(1440)
  })

  it('resolves em against the supplied font size', () => {
    expect(cssLengthToTwips('1em', 12)).toBe(240)
    expect(cssLengthToTwips('1.5em', 12)).toBe(360)
  })

  it('treats a bare number as px and rejects invalid input', () => {
    expect(cssLengthToTwips('10')).toBe(150)
    expect(cssLengthToTwips('')).toBeUndefined()
    expect(cssLengthToTwips('abc')).toBeUndefined()
  })
})

describe('cssLineHeightToTwips', () => {
  it('multiplies unitless line heights by the font size', () => {
    expect(cssLineHeightToTwips('1.65', 12)).toBe(396)
    expect(cssLineHeightToTwips('1.2', 24)).toBe(576)
  })

  it('converts lengths with the shared unit rules', () => {
    expect(cssLineHeightToTwips('20px', 12)).toBe(300)
    expect(cssLineHeightToTwips('', 12)).toBeUndefined()
  })
})

describe('cssLengthToPt', () => {
  it('converts the units used by imported documents', () => {
    expect(cssLengthToPt('12pt')).toBe(12)
    expect(cssLengthToPt('16px')).toBe(12)
    expect(cssLengthToPt('1em', 12)).toBe(12)
    expect(cssLengthToPt('1in')).toBe(72)
    expect(cssLengthToPt('2.54cm')).toBe(72)
    expect(cssLengthToPt('25.4mm')).toBeCloseTo(72)
  })

  it('rejects invalid input', () => {
    expect(cssLengthToPt('abc')).toBeUndefined()
    expect(cssLengthToPt(undefined)).toBeUndefined()
  })
})

describe('parseFontFamily', () => {
  it('keeps the first family and strips quotes', () => {
    expect(parseFontFamily('"Times New Roman", serif')).toBe('Times New Roman')
    expect(parseFontFamily("'Arial'")).toBe('Arial')
  })

  it('falls back to the editor default', () => {
    expect(parseFontFamily('')).toBe('Arial')
    expect(parseFontFamily(undefined)).toBe('Arial')
  })
})

describe('resolveLinkUrl', () => {
  it('keeps supported protocols and adds https to bare hosts', () => {
    expect(resolveLinkUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(resolveLinkUrl('example.com')).toBe('https://example.com/')
    expect(resolveLinkUrl('//example.com/x')).toBe('https://example.com/x')
    expect(resolveLinkUrl('mailto:a@example.com')).toBe('mailto:a@example.com')
    expect(resolveLinkUrl('tel:+5511999999999')).toBe('tel:+5511999999999')
  })

  it('rejects empty, unsafe and malformed URLs', () => {
    expect(resolveLinkUrl('')).toBeUndefined()
    expect(resolveLinkUrl(null)).toBeUndefined()
    expect(resolveLinkUrl('javascript:alert(1)')).toBeUndefined()
    expect(resolveLinkUrl('ftp://example.com')).toBeUndefined()
  })
})

describe('parseLayoutDeclarations / serializeLayoutDeclarations', () => {
  it('parses the docxLayout attribute into a declaration map', () => {
    expect(parseLayoutDeclarations('line-height:1.2;margin-top:10pt')).toEqual({ 'line-height': '1.2', 'margin-top': '10pt' })
    expect(parseLayoutDeclarations('  LINE-HEIGHT : 1.2 ; ')).toEqual({ 'line-height': '1.2' })
  })

  it('ignores malformed declarations', () => {
    expect(parseLayoutDeclarations('invalid;:x;y:')).toEqual({})
    expect(parseLayoutDeclarations(null)).toEqual({})
  })

  it('round-trips the declarations and drops empty values', () => {
    expect(serializeLayoutDeclarations({ 'line-height': '1.2', 'margin-top': '' })).toBe('line-height:1.2')
    expect(serializeLayoutDeclarations({})).toBeNull()
  })
})

describe('heading spacing helpers', () => {
  it('uses the compact line height for h1 and the body line height for the rest', () => {
    expect(headingLineHeight(1)).toBe(1.2)
    expect(headingLineHeight(2)).toBe(1.65)
  })

  it('returns the twips gaps documented for each level', () => {
    expect(headingGap(1)).toEqual({ before: 96, after: 312 })
    expect(headingGap(2)).toEqual({ before: 144, after: 216 })
    expect(headingGap(6)).toEqual({ before: 130, after: 80 })
  })
})

describe('readDocs', () => {
  it('returns an empty list when nothing was saved', () => {
    expect(readDocs()).toEqual([])
  })

  it('tolerates corrupted storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(readDocs()).toEqual([])
  })

  it('reads the saved documents', () => {
    const docs = [{ title: 'Doc', content: '<p>x</p>', updatedAt: 1 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
    expect(readDocs()).toEqual(docs)
  })
})

describe('isListContinuation', () => {
  it('always joins adjacent bullet lists', () => {
    expect(isListContinuation({ type: 'bulletList', start: 1, count: 3 }, { type: 'bulletList', start: 1, firstItemContinues: false })).toBe(true)
  })

  it('joins ordered lists only when the numbering continues', () => {
    expect(isListContinuation({ type: 'orderedList', start: 1, count: 3 }, { type: 'orderedList', start: 4, firstItemContinues: false })).toBe(true)
    // A split item repeats its number, so the continuation starts one below.
    expect(isListContinuation({ type: 'orderedList', start: 1, count: 3 }, { type: 'orderedList', start: 3, firstItemContinues: true })).toBe(true)
    // A deliberate restart must not be joined.
    expect(isListContinuation({ type: 'orderedList', start: 1, count: 3 }, { type: 'orderedList', start: 1, firstItemContinues: false })).toBe(false)
  })

  it('is type-agnostic; the caller guards that both chunks share a type', () => {
    // adjacentListJoins and the DOCX writer only call this helper after checking
    // that the two chunks have the same list type. The helper itself only
    // inspects numbering, so this combination is expected to match.
    expect(isListContinuation({ type: 'bulletList', start: 1, count: 2 }, { type: 'orderedList', start: 3, firstItemContinues: false })).toBe(true)
    expect(isListContinuation({ type: 'orderedList', start: 1, count: 2 }, { type: 'orderedList', start: 7, firstItemContinues: false })).toBe(false)
  })
})
