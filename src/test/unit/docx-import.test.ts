import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { convertDocxToEditableHtml } from '../../docx-import'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships'

function documentXml(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="${W}" xmlns:r="${R}"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>${body}</w:body>
</w:document>`
}

function paragraph(content: string, properties = '') {
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${content}</w:p>`
}

function run(text: string, properties = '') {
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`
}

async function makeDocx(parts: Record<string, string>, media: Record<string, Uint8Array> = {}) {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(parts)) zip.file(name, content)
  for (const [name, bytes] of Object.entries(media)) zip.file(name, bytes)
  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([buffer], 'documento.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

const baseRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${RELS}">
  <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
  <Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com" TargetMode="External"/>
</Relationships>`

const baseStyles = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="${W}">
  <w:style w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:styleId="Titulo3"><w:name w:val="Título 3"/></w:style>
  <w:style w:styleId="Title"><w:name w:val="Title"/></w:style>
  <w:style w:styleId="Subtitle"><w:name w:val="Subtitle"/></w:style>
</w:styles>`

const baseNumbering = `<?xml version="1.0" encoding="UTF-8"?>
<w:numbering xmlns:w="${W}">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`

const baseContentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="png" ContentType="image/png"/>
</Types>`

async function convert(body: string, options: { styles?: boolean; numbering?: boolean; rels?: boolean } = {}) {
  const parts: Record<string, string> = {
    '[Content_Types].xml': baseContentTypes,
    'word/document.xml': documentXml(body),
  }
  if (options.styles !== false) parts['word/styles.xml'] = baseStyles
  if (options.numbering !== false) parts['word/numbering.xml'] = baseNumbering
  if (options.rels !== false) parts['word/_rels/document.xml.rels'] = baseRels
  return convertDocxToEditableHtml(await makeDocx(parts))
}

describe('convertDocxToEditableHtml', () => {
  it('converts paragraphs, escaping text', async () => {
    const html = await convert(paragraph(run('Olá &amp; bem-vindo')))

    expect(html).toBe('<p>Olá &amp; bem-vindo</p>')
  })

  it('maps run formatting to inline markup and styles', async () => {
    const html = await convert(paragraph(
      run('negrito', '<w:b/>') +
      run('itálico', '<w:i/>') +
      run('sublinhado', '<w:u w:val="single"/>') +
      run('riscado', '<w:strike/>') +
      run('sob', '<w:vertAlign w:val="superscript"/>') +
      run('sub', '<w:vertAlign w:val="subscript"/>') +
      run('colorido', '<w:color w:val="D93025"/><w:sz w:val="40"/><w:rFonts w:ascii="Georgia"/>'),
    ))

    expect(html).toContain('<strong>negrito</strong>')
    expect(html).toContain('<em>itálico</em>')
    expect(html).toContain('<u>sublinhado</u>')
    expect(html).toContain('<s>riscado</s>')
    expect(html).toContain('<sup>sob</sup>')
    expect(html).toContain('<sub>sub</sub>')
    expect(html).toContain('color:#D93025')
    expect(html).toContain('font-size:20pt')
    expect(html).toContain('font-family:Georgia')
  })

  it('keeps the heading level from English and localised style names', async () => {
    const html = await convert(
      paragraph(run('Título um'), '<w:pStyle w:val="Heading1"/>') +
      paragraph(run('Título três'), '<w:pStyle w:val="Titulo3"/>') +
      paragraph(run('Title'), '<w:pStyle w:val="Title"/>') +
      paragraph(run('Subtitle'), '<w:pStyle w:val="Subtitle"/>'),
    )

    expect(html).toContain('<h1>Título um</h1>')
    expect(html).toContain('<h3>Título três</h3>')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<h2>Subtitle</h2>')
  })

  it('ignores explicit run sizes inside headings so the CSS level wins', async () => {
    const html = await convert(paragraph(run('Título', '<w:sz w:val="72"/>'), '<w:pStyle w:val="Heading1"/>'))

    expect(html).toBe('<h1>Título</h1>')
  })

  it('converts paragraph alignment, spacing and indentation', async () => {
    const html = await convert(paragraph(
      run('Texto'),
      '<w:jc w:val="both"/><w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:left="720" w:right="360" w:firstLine="240"/>',
    ))

    expect(html).toContain('text-align:justify')
    expect(html).toContain('margin-top:16px')
    expect(html).toContain('margin-bottom:8px')
    expect(html).toContain('line-height:1.5')
    expect(html).toContain('margin-left:48px')
    expect(html).toContain('margin-right:24px')
    expect(html).toContain('text-indent:16px')
  })

  it('groups consecutive numbered paragraphs into a list', async () => {
    const bullet = paragraph(run('Item A'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')
    const ordered = paragraph(run('Passo 1'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>')

    const html = await convert(bullet + bullet.replace('Item A', 'Item B') + ordered)

    expect(html).toBe('<ul><li><p>Item A</p></li><li><p>Item B</p></li></ul><ol><li><p>Passo 1</p></li></ol>')
  })

  it('converts hyperlinks through the relationship target', async () => {
    const html = await convert(paragraph('<w:hyperlink r:id="rIdLink">' + run('Site') + '</w:hyperlink>'))

    expect(html).toBe('<p><a href="https://example.com">Site</a></p>')
  })

  it('converts tables and marks header rows', async () => {
    const html = await convert(
      `<w:tbl><w:tblPr><w:tblW w:w="3000"/></w:tblPr>
        <w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:p>${run('Cabeçalho')}</w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p>${run('Dado')}</w:p></w:tc></w:tr>
      </w:tbl>`,
    )

    expect(html).toContain('<table style="width:200px"><tbody>')
    expect(html).toContain('<tr><th><p>Cabeçalho</p></th></tr>')
    expect(html).toContain('<tr><td><p>Dado</p></td></tr>')
  })

  it('converts page breaks before paragraphs', async () => {
    const html = await convert(paragraph(run('Depois da quebra'), '<w:pageBreakBefore/>'))

    expect(html).toBe('<div data-page-break="true"></div><p>Depois da quebra</p>')
  })

  it('embeds images with dimensions from the drawing extent', async () => {
    const png = Uint8Array.from([137, 80, 78, 71])
    const zip = new JSZip()
    zip.file('[Content_Types].xml', baseContentTypes)
    zip.file('word/_rels/document.xml.rels', baseRels)
    zip.file('word/styles.xml', baseStyles)
    zip.file('word/numbering.xml', baseNumbering)
    zip.file('word/media/image1.png', png)
    zip.file('word/document.xml', documentXml(paragraph(
      '<w:r><w:drawing><wp:inline><wp:extent cx="952500" cy="476250"/><wp:docPr id="1" name="Imagem" descr="Foto"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rIdImage"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>',
    )))
    const file = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'imagem.docx')

    const html = await convertDocxToEditableHtml(file)

    expect(html).toContain('<img src="data:image/png;base64,')
    expect(html).toContain('alt="Foto"')
    expect(html).toContain('width="100"')
    expect(html).toContain('height="50"')
  })

  it('rejects files without the main document part', async () => {
    const zip = new JSZip()
    zip.file('word/styles.xml', baseStyles)
    const file = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'vazio.docx')

    await expect(convertDocxToEditableHtml(file)).rejects.toThrow('Arquivo DOCX sem conteúdo principal')
  })

  it('rejects malformed XML', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', '<w:document><w:body>')
    const file = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'quebrado.docx')

    await expect(convertDocxToEditableHtml(file)).rejects.toThrow('XML DOCX inválido')
  })

  it('rejects documents without a body section', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', `<w:document xmlns:w="${W}"><w:p>${run('Órfão')}</w:p></w:document>`)
    const file = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'sem-corpo.docx')

    await expect(convertDocxToEditableHtml(file)).rejects.toThrow('DOCX sem seção principal')
  })

  it('returns an empty paragraph when the body has no blocks', async () => {
    const html = await convert('')

    expect(html).toBe('<p></p>')
  })
})
