import JSZip from 'jszip'

const children = (node: Element) => Array.from(node.children)
const child = (node: Element, name: string) => children(node).find(item => item.localName === name)
const descendants = (node: Element, name: string) => Array.from(node.getElementsByTagNameNS('*', name))
const attr = (node: Element | undefined, name: string) => node?.getAttribute(`w:${name}`) || node?.getAttribute(name) || ''
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const twipsToPx = (value: string) => Number.isFinite(Number(value)) ? Number(value) / 15 : 0

type Relationship = { target: string; type: string }

export async function convertDocxToEditableHtml(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const documentFile = zip.file('word/document.xml')
  if (!documentFile) throw new Error('Arquivo DOCX sem conteúdo principal')
  const xml = new DOMParser().parseFromString(await documentFile.async('text'), 'application/xml')
  if (xml.getElementsByTagName('parsererror').length) throw new Error('XML DOCX inválido')
  const relationships = new Map<string, Relationship>()
  const relationshipsFile = zip.file('word/_rels/document.xml.rels')
  if (relationshipsFile) {
    const relXml = new DOMParser().parseFromString(await relationshipsFile.async('text'), 'application/xml')
    for (const rel of Array.from(relXml.getElementsByTagNameNS('*', 'Relationship'))) {
      relationships.set(rel.getAttribute('Id') || '', { target: rel.getAttribute('Target') || '', type: rel.getAttribute('Type') || '' })
    }
  }
  const styleNames = new Map<string, string>()
  const stylesFile = zip.file('word/styles.xml')
  if (stylesFile) {
    const stylesXml = new DOMParser().parseFromString(await stylesFile.async('text'), 'application/xml')
    for (const style of Array.from(stylesXml.getElementsByTagNameNS('*', 'style'))) {
      const id = style.getAttribute('w:styleId') || ''
      const name = child(style, 'name')?.getAttribute('w:val') || id
      styleNames.set(id, name)
    }
  }
  const numberingFormats = new Map<string, string>()
  const numberingFile = zip.file('word/numbering.xml')
  if (numberingFile) {
    const numberingXml = new DOMParser().parseFromString(await numberingFile.async('text'), 'application/xml')
    const abstractFormats = new Map<string, string>()
    for (const abstract of Array.from(numberingXml.getElementsByTagNameNS('*', 'abstractNum'))) {
      const id = abstract.getAttribute('w:abstractNumId') || ''
      const format = attr(descendants(abstract, 'numFmt')[0], 'val')
      abstractFormats.set(id, format)
    }
    for (const number of Array.from(numberingXml.getElementsByTagNameNS('*', 'num'))) {
      const id = number.getAttribute('w:numId') || ''
      const abstractId = attr(child(number, 'abstractNumId'), 'val')
      numberingFormats.set(id, abstractFormats.get(abstractId) || 'decimal')
    }
  }
  const contentTypesFile = zip.file('[Content_Types].xml')
  const contentTypes = new Map<string, string>()
  if (contentTypesFile) {
    const typesXml = new DOMParser().parseFromString(await contentTypesFile.async('text'), 'application/xml')
    for (const item of Array.from(typesXml.getElementsByTagNameNS('*', 'Default'))) contentTypes.set(item.getAttribute('Extension') || '', item.getAttribute('ContentType') || '')
  }

  const relationId = (element: Element) => element.getAttribute('r:id') || element.getAttribute('r:embed') || element.getAttribute('r:link') || ''
  const imageHtml = async (drawing: Element): Promise<string> => {
    const blip = descendants(drawing, 'blip')[0]
    if (!blip) return ''
    const rel = relationships.get(relationId(blip))
    if (!rel || rel.target.startsWith('http')) return ''
    const path = rel.target.startsWith('/') ? rel.target.slice(1) : `word/${rel.target.replace(/^\.\.\//, '')}`
    const image = zip.file(path)
    if (!image) return ''
    const extension = path.split('.').pop()?.toLowerCase() || 'png'
    const mime = contentTypes.get(extension) || `image/${extension === 'jpg' ? 'jpeg' : extension}`
    const base64 = await image.async('base64')
    const extent = descendants(drawing, 'extent')[0]
    const width = extent ? Math.round(Number(extent.getAttribute('cx')) / 9525) : 0
    const height = extent ? Math.round(Number(extent.getAttribute('cy')) / 9525) : 0
    const docPr = descendants(drawing, 'docPr')[0]
    const dimensions = `${width ? `width="${width}"` : ''} ${height ? `height="${height}"` : ''}`
    return `<img src="data:${escape(mime)};base64,${base64}" alt="${escape(docPr?.getAttribute('descr') || docPr?.getAttribute('name') || 'Imagem')}" ${dimensions} />`
  }
  const runHtml = async (run: Element, skipFontSize = false): Promise<string> => {
    const properties = child(run, 'rPr')
    const css: string[] = []
    const fonts = child(properties || run, 'rFonts')
    const font = attr(fonts, 'ascii') || attr(fonts, 'hAnsi')
    if (font) css.push(`font-family:${escape(font.replace(/[^\w\s,.-]/g, ''))}`)
    const size = attr(child(properties || run, 'sz'), 'val')
    // Heading sizes come from the h1-h6 rules, so an explicit run size (which
    // our own export writes) would freeze the heading and hide level changes.
    if (size && !skipFontSize) css.push(`font-size:${Number(size) / 2}pt`)
    const color = attr(child(properties || run, 'color'), 'val')
    if (/^[\da-f]{6}$/i.test(color)) css.push(`color:#${color}`)
    const highlight = attr(child(properties || run, 'highlight'), 'val')
    const shading = attr(child(properties || run, 'shd'), 'fill')
    const colorNames: Record<string, string> = { yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#00008b', darkCyan: '#008b8b', darkGreen: '#006400', darkMagenta: '#800080', darkRed: '#8b0000', darkYellow: '#808000', darkGray: '#a9a9a9', lightGray: '#d3d3d3', black: '#000000', white: '#ffffff' }
    if (colorNames[highlight]) css.push(`background-color:${colorNames[highlight]}`)
    else if (/^[\da-f]{6}$/i.test(shading)) css.push(`background-color:#${shading}`)
    let html = ''
    for (const item of children(run)) {
      if (item.localName === 't' || item.localName === 'delText') html += escape(item.textContent || '')
      else if (item.localName === 'tab') html += '&emsp;'
      else if (item.localName === 'br') html += attr(item, 'type') === 'page' ? '<div data-page-break="true"></div>' : '<br />'
      else if (item.localName === 'drawing' || item.localName === 'pict') html += await imageHtml(item)
    }
    const truthy = (name: string) => { const property = child(properties || run, name); if (!property) return false; const value = attr(property, 'val'); return !['0', 'false', 'off', 'none'].includes(value) }
    if (truthy('b')) html = `<strong>${html}</strong>`
    if (truthy('i')) html = `<em>${html}</em>`
    const underline = attr(child(properties || run, 'u'), 'val')
    if (underline !== 'none' && child(properties || run, 'u')) html = `<u>${html}</u>`
    if (truthy('strike') || truthy('dstrike')) html = `<s>${html}</s>`
    const vertical = attr(child(properties || run, 'vertAlign'), 'val')
    if (vertical === 'superscript') html = `<sup>${html}</sup>`
    if (vertical === 'subscript') html = `<sub>${html}</sub>`
    return css.length ? `<span style="${css.join(';')}">${html}</span>` : html
  }
  const paragraphHtml = async (paragraph: Element): Promise<{ html: string; list?: 'ol' | 'ul' }> => {
    const properties = child(paragraph, 'pPr')
    const styleId = attr(child(properties || paragraph, 'pStyle'), 'val')
    const styleName = (styleNames.get(styleId) || styleId).toLowerCase()
    // Keep the original outline level instead of collapsing every level into
    // Heading 2. Word's style ids are English even in translated installs, but
    // the display names can be localised (e.g. "Título 3").
    const headingMatch = styleName.match(/(?:heading|t[íi]?tulo)\s*([1-6])/)
    const heading = headingMatch ? Number(headingMatch[1]) : /(?:^|\s)title\b/.test(styleName) ? 1 : /(?:^|\s)subtitle\b/.test(styleName) ? 2 : 0
    const css: string[] = []
    const alignment = attr(child(properties || paragraph, 'jc'), 'val')
    if (['left', 'center', 'right', 'start', 'end'].includes(alignment) || alignment === 'both') css.push(`text-align:${alignment === 'both' ? 'justify' : alignment}`)
    const spacing = child(properties || paragraph, 'spacing')
    const before = attr(spacing || paragraph, 'before'), after = attr(spacing || paragraph, 'after'), line = attr(spacing || paragraph, 'line')
    if (before) css.push(`margin-top:${twipsToPx(before)}px`)
    if (after) css.push(`margin-bottom:${twipsToPx(after)}px`)
    if (line) {
      const rule = attr(spacing || paragraph, 'lineRule')
      css.push(`line-height:${rule === 'auto' || !rule ? Number(line) / 240 : `${twipsToPx(line)}px`}`)
    }
    const indent = child(properties || paragraph, 'ind')
    const left = attr(indent || paragraph, 'left'), right = attr(indent || paragraph, 'right')
    const firstLine = attr(indent || paragraph, 'firstLine'), hanging = attr(indent || paragraph, 'hanging')
    if (left) css.push(`margin-left:${twipsToPx(left)}px`)
    if (right) css.push(`margin-right:${twipsToPx(right)}px`)
    if (firstLine) css.push(`text-indent:${twipsToPx(firstLine)}px`)
    if (hanging) css.push(`text-indent:-${twipsToPx(hanging)}px`)
    const keepPageBreak = !!child(properties || paragraph, 'pageBreakBefore')
    let content = ''
    for (const item of children(paragraph)) {
      if (item.localName === 'r') content += await runHtml(item, heading > 0)
      else if (item.localName === 'hyperlink') {
        const id = relationId(item)
        const rel = relationships.get(id)
        const href = rel?.target || (item.getAttribute('w:anchor') ? `#${item.getAttribute('w:anchor')}` : '')
        const label = (await Promise.all(children(item).filter(run => run.localName === 'r').map(run => runHtml(run, heading > 0)))).join('')
        content += href ? `<a href="${escape(href)}">${label}</a>` : label
      }
    }
    const tag = heading ? `h${heading}` : 'p'
    const style = css.length ? ` style="${css.join(';')}"` : ''
    const paragraphMarkup = `<${tag}${style}>${content || '<br />'}</${tag}>`
    const numPr = child(properties || paragraph, 'numPr')
    const numId = attr(child(numPr || paragraph, 'numId'), 'val')
    const numFmt = numberingFormats.get(numId) || ''
    const list = numPr ? (/bullet|none|symbol/i.test(numFmt) ? 'ul' : 'ol') : undefined
    return { html: `${keepPageBreak ? '<div data-page-break="true"></div>' : ''}${paragraphMarkup}`, list }
  }
  const cellHtml = async (cell: Element): Promise<string> => {
    const props = child(cell, 'tcPr')
    const shade = attr(child(props || cell, 'shd'), 'fill')
    const width = attr(child(props || cell, 'tcW'), 'w')
    const style = [shade && /^[\da-f]{6}$/i.test(shade) ? `background-color:#${shade}` : '', width && /^\d+$/.test(width) ? `min-width:${twipsToPx(width)}px` : ''].filter(Boolean).join(';')
    const content: string[] = []
    for (const item of children(cell)) {
      if (item.localName === 'p') content.push((await paragraphHtml(item)).html)
      else if (item.localName === 'tbl') content.push(await tableHtml(item))
    }
    return `<td${style ? ` style="${style}"` : ''}>${content.join('') || '<p><br /></p>'}</td>`
  }
  const tableHtml = async (table: Element): Promise<string> => {
    const rows: string[] = []
    for (const row of children(table).filter(item => item.localName === 'tr')) {
      const isHeader = !!child(child(row, 'trPr') || row, 'tblHeader')
      const cells = await Promise.all(children(row).filter(item => item.localName === 'tc').map(async cell => {
        const markup = await cellHtml(cell)
        return isHeader ? markup.replace(/^<td/, '<th').replace(/<\/td>$/, '</th>') : markup
      }))
      rows.push(`<tr>${cells.join('')}</tr>`)
    }
    const width = attr(child(child(table, 'tblPr') || table, 'tblW'), 'w')
    const style = width && width !== '0' ? ` style="width:${twipsToPx(width)}px"` : ''
    return `<table${style}><tbody>${rows.join('')}</tbody></table>`
  }
  const body = descendants(xml.documentElement, 'body')[0]
  if (!body) throw new Error('DOCX sem seção principal')
  const bodyHtml: string[] = []
  let activeList: 'ol' | 'ul' | undefined
  let listItems: string[] = []
  const flushList = () => { if (activeList) bodyHtml.push(`<${activeList}>${listItems.join('')}</${activeList}>`); activeList = undefined; listItems = [] }
  for (const block of children(body)) {
    if (block.localName === 'p') {
      const result = await paragraphHtml(block)
      if (result.list) {
        if (activeList !== result.list) { flushList(); activeList = result.list }
        listItems.push(`<li>${result.html}</li>`)
      } else { flushList(); bodyHtml.push(result.html) }
    } else if (block.localName === 'tbl') { flushList(); bodyHtml.push(await tableHtml(block)) }
  }
  flushList()
  return bodyHtml.join('') || '<p></p>'
}
