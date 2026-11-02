import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { applyPaintedFormat, capturePaintedFormat, mergePaintedMarks, type PaintedFormat } from '../../App'
import { createTestEditor, destroyTestEditor, select } from '../editor'

let editor: Editor | null = null

function open(content: string) {
  editor = createTestEditor(content)
  return editor
}

function findNode(instance: Editor, type: string): { pos: number; node: { content: { size: number } } } | null {
  let found: { pos: number; node: { content: { size: number } } } | null = null
  instance.state.doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === type) {
      found = { pos, node }
      return false
    }
    return true
  })
  return found
}

afterEach(() => {
  if (editor) destroyTestEditor(editor)
  editor = null
})

describe('capturePaintedFormat', () => {
  it('captures the marks and block style of the selected text', () => {
    const instance = open('<h1><strong>Titulo</strong></h1><p>Destino</p>')
    select(instance, 1, 7)

    const format = capturePaintedFormat(instance)

    expect(format.block).toEqual({ type: 'heading', level: 1, textAlign: null, docxLayout: null })
    expect(format.marks.map(mark => mark.type)).toEqual(['bold'])
  })

  it('materializes the visual style of headings in blockMarks', () => {
    const instance = open('<h1>Titulo sem marcas</h1>')
    select(instance, 1, 17)

    const format = capturePaintedFormat(instance)

    expect(format.marks).toEqual([])
    expect(format.blockMarks).toContainEqual({ type: 'bold' })
    expect(format.blockMarks).toContainEqual({ type: 'textStyle', attrs: { fontSize: '24pt' } })
  })

  it('does not duplicate an explicit size already present in the text', () => {
    const instance = open('<h2><span style="font-size: 30pt">Titulo</span></h2>')
    select(instance, 1, 7)

    const format = capturePaintedFormat(instance)

    expect(format.marks.some(mark => mark.type === 'textStyle' && mark.attrs?.fontSize === '30pt')).toBe(true)
    expect(format.blockMarks.some(mark => mark.type === 'textStyle')).toBe(false)
  })

  it('never copies link marks', () => {
    const instance = open('<p><a href="https://example.com">Origem</a></p><p>Destino</p>')
    select(instance, 1, 7)

    const format = capturePaintedFormat(instance)

    expect(format.marks.some(mark => mark.type === 'link')).toBe(false)
  })

  it('captures alignment and docxLayout from the source paragraph', () => {
    const instance = open('<p style="text-align: center; line-height: 1.2">Origem</p>')
    instance.commands.updateAttributes('paragraph', { docxLayout: 'line-height:1.2' })
    select(instance, 1, 7)

    const format = capturePaintedFormat(instance)

    expect(format.block.textAlign).toBe('center')
    expect(format.block.docxLayout).toBe('line-height:1.2')
  })
})

describe('applyPaintedFormat', () => {
  function headingFormat(instance: Editor): PaintedFormat {
    select(instance, 1, 14)
    return capturePaintedFormat(instance)
  }

  it('applies inline formatting only to the selected range', () => {
    const instance = open('<h1>Titulo origem</h1><p>Paragrafo destino</p>')
    const format = headingFormat(instance)
    select(instance, 16, 24)

    expect(applyPaintedFormat(instance, format)).toBe('applied')

    const html = instance.getHTML()
    expect(html).toContain('<strong>Paragraf</strong>')
    expect(html).toContain('o destino')
    // A partial selection must not turn the paragraph into a heading.
    expect(instance.state.doc.child(1).type.name).toBe('paragraph')
  })

  it('copies the heading level when the whole paragraph is selected', () => {
    const instance = open('<h2>Titulo origem</h2><p>Paragrafo destino</p>')
    const format = headingFormat(instance)
    select(instance, 16, 33)

    expect(applyPaintedFormat(instance, format)).toBe('applied')

    const paragraph = instance.state.doc.child(1)
    expect(paragraph.type.name).toBe('heading')
    expect(paragraph.attrs.level).toBe(2)
  })

  it('keeps list items as paragraphs and still copies alignment', () => {
    const instance = open('<h2 style="text-align: center">Titulo</h2><ul><li><p>Item da lista</p></li></ul>')
    select(instance, 1, 7)
    const format = capturePaintedFormat(instance)
    const paragraph = findNode(instance, 'paragraph')!
    select(instance, paragraph.pos + 1, paragraph.pos + 1 + paragraph.node.content.size)

    expect(applyPaintedFormat(instance, format)).toBe('applied')

    const item = instance.state.doc.child(1).firstChild!.firstChild!
    expect(item.type.name).toBe('paragraph')
    expect(item.attrs.textAlign).toBe('center')
  })

  it('preserves links in the target text', () => {
    const instance = open('<p>Origem</p><p><a href="https://example.com">Destino</a></p>')
    select(instance, 1, 7)
    const format = capturePaintedFormat(instance)
    select(instance, 9, 16)

    expect(applyPaintedFormat(instance, format)).toBe('applied')

    expect(instance.getHTML()).toContain('href="https://example.com"')
  })

  it('clears formatting when the source is plain text', () => {
    const instance = open('<p>Origem simples</p><p>Destino <strong>negrito</strong> aqui</p>')
    select(instance, 1, 14)
    const format = capturePaintedFormat(instance)
    select(instance, 24, 31)

    expect(applyPaintedFormat(instance, format)).toBe('applied')

    expect(instance.getHTML()).not.toContain('<strong>negrito</strong>')
  })

  it('does nothing with a collapsed cursor', () => {
    const instance = open('<p><strong>Origem</strong></p><p>Destino</p>')
    select(instance, 1, 7)
    const format = capturePaintedFormat(instance)
    select(instance, 9)
    const before = instance.getHTML()

    expect(applyPaintedFormat(instance, format)).toBe('no-selection')
    expect(instance.getHTML()).toBe(before)
  })

  it('reports no-change when only paragraph attributes were copied into a partial selection', () => {
    const instance = open('<p style="text-align: center">Origem</p><p>Destino com texto</p>')
    select(instance, 1, 7)
    const format = capturePaintedFormat(instance)
    select(instance, 9, 14)
    const before = instance.getHTML()

    expect(applyPaintedFormat(instance, format)).toBe('no-change')
    expect(instance.getHTML()).toBe(before)
  })
})

describe('mergePaintedMarks', () => {
  it('keeps explicit textStyle attributes while adding the heading size', () => {
    const merged = mergePaintedMarks(
      [{ type: 'textStyle', attrs: { color: '#d93025' } }],
      [{ type: 'textStyle', attrs: { fontSize: '24pt' } }, { type: 'bold' }],
    )

    expect(merged).toContainEqual({ type: 'textStyle', attrs: { fontSize: '24pt', color: '#d93025' } })
    expect(merged).toContainEqual({ type: 'bold' })
  })

  it('does not duplicate marks of the same type', () => {
    const merged = mergePaintedMarks([{ type: 'bold' }], [{ type: 'bold' }])

    expect(merged).toEqual([{ type: 'bold' }])
  })
})
