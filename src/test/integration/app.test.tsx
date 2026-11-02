import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import App, { STORAGE_KEY } from '../../App'

function editorElement() {
  const element = document.querySelector('.document-editor') as (HTMLElement & { editor?: Editor }) | null
  if (!element?.editor) throw new Error('O editor não foi montado')
  return element as HTMLElement & { editor: Editor }
}

function editor() {
  return editorElement().editor
}

async function renderApp() {
  const view = render(<App />)
  await waitFor(() => expect(editorElement()).toBeInTheDocument())
  return view
}

function select(from: number, to = from) {
  act(() => { editor().commands.setTextSelection({ from, to }) })
}

function pressPaintButton() {
  const button = screen.getByRole('button', { name: 'Copiar formatação' })
  fireEvent.click(button)
  return button
}

// Simulates the mouse gesture the app listens to on document: the press must
// start inside the editable area, and the selection is applied on mouseup.
function mouseSelect(from: number, to: number) {
  act(() => {
    editor().commands.setTextSelection({ from, to })
    const dom = editorElement()
    const options = { bubbles: true, cancelable: true, clientX: 0, clientY: 0, button: 0 }
    dom.dispatchEvent(new MouseEvent('mousedown', { ...options, buttons: 1 }))
    dom.dispatchEvent(new MouseEvent('mouseup', { ...options, buttons: 0 }))
  })
}

afterEach(() => {
  window.getSelection()?.removeAllRanges()
})

describe('App: estrutura e acessibilidade', () => {
  it('renders the editor with the starter document', async () => {
    await renderApp()

    expect(editor().getText()).toContain('Bem-vindo ao Wordpad')
    expect(screen.getByRole('button', { name: 'Abrir guia de uso' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nome do documento' })).toBeInTheDocument()
  })

  it('exposes the paint format button as a toggle', async () => {
    await renderApp()
    const button = screen.getByRole('button', { name: 'Copiar formatação' })

    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('type', 'button')
  })
})

describe('App: copiar formatação', () => {
  it('arms on click and disarms on a second click', async () => {
    await renderApp()
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Copiar formatação' })

    await user.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
    expect(editorElement()).toHaveClass('paint-format-active')

    await user.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))
    expect(editorElement()).not.toHaveClass('paint-format-active')
  })

  it('cancels with Escape without touching the document', async () => {
    await renderApp()
    act(() => {
      editor().commands.setContent('<h1>Titulo origem</h1><p>Paragrafo destino</p>', true)
      editor().commands.setTextSelection({ from: 1, to: 14 })
    })
    pressPaintButton()
    await waitFor(() => expect(editorElement()).toHaveClass('paint-format-active'))
    const before = editor().getHTML()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(editorElement()).not.toHaveClass('paint-format-active'))
    expect(editor().getHTML()).toBe(before)
  })

  it('applies the copied format to a partial mouse selection only', async () => {
    await renderApp()
    act(() => {
      editor().commands.setContent('<h1>Titulo origem</h1><p>Paragrafo destino</p>', true)
      editor().commands.setTextSelection({ from: 1, to: 14 })
    })
    pressPaintButton()
    await waitFor(() => expect(editorElement()).toHaveClass('paint-format-active'))

    mouseSelect(16, 24)

    await waitFor(() => expect(editorElement()).not.toHaveClass('paint-format-active'))
    const html = editor().getHTML()
    expect(html).toContain('<strong>Paragraf</strong>')
    expect(html).toContain('font-size: 24pt')
    expect(editor().state.doc.child(1).type.name).toBe('paragraph')
  })

  it('copies the heading level when the whole paragraph is selected', async () => {
    await renderApp()
    act(() => {
      editor().commands.setContent('<h2>Titulo origem</h2><p>Paragrafo destino</p>', true)
      editor().commands.setTextSelection({ from: 1, to: 14 })
    })
    pressPaintButton()
    await waitFor(() => expect(editorElement()).toHaveClass('paint-format-active'))

    mouseSelect(16, 33)

    await waitFor(() => expect(editor().state.doc.child(1).type.name).toBe('heading'))
    expect(editor().state.doc.child(1).attrs.level).toBe(2)
  })

  it('keeps the brush armed and explains when only paragraph attributes were copied', async () => {
    await renderApp()
    act(() => {
      editor().commands.setContent('<p style="text-align: center">Origem</p><p>Destino com texto</p>', true)
      editor().commands.setTextSelection({ from: 1, to: 7 })
    })
    pressPaintButton()
    await waitFor(() => expect(editorElement()).toHaveClass('paint-format-active'))

    mouseSelect(9, 14)

    await waitFor(() => expect(screen.getByText(/Nada a aplicar neste trecho/)).toBeInTheDocument())
    expect(editorElement()).toHaveClass('paint-format-active')
  })

  it('stays armed after applying when the button was double clicked', async () => {
    await renderApp()
    act(() => {
      editor().commands.setContent('<p><strong>Origem</strong></p><p>Destino um</p><p>Destino dois</p>', true)
      editor().commands.setTextSelection({ from: 1, to: 7 })
    })
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Copiar formatação' }))
    await waitFor(() => expect(editorElement()).toHaveClass('paint-format-active'))

    mouseSelect(9, 19)

    await waitFor(() => expect(editor().getHTML()).toContain('<strong>Destino um</strong>'))
    expect(editorElement()).toHaveClass('paint-format-active')
    expect(screen.getByText(/Formatação aplicada\. Selecione outro destino/)).toBeInTheDocument()

    // The sticky brush can format a second target without being re-armed.
    mouseSelect(21, 33)

    await waitFor(() => expect(editor().getHTML()).toContain('<strong>Destino dois</strong>'))
    expect(editorElement()).toHaveClass('paint-format-active')
  })

  it('applies a keyboard selection after the debounce', async () => {
    await renderApp()
    act(() => {
      editor().commands.setContent('<p><strong>Origem</strong></p><p>Destino</p>', true)
      editor().commands.setTextSelection({ from: 1, to: 7 })
    })
    pressPaintButton()
    await waitFor(() => expect(editorElement()).toHaveClass('paint-format-active'))

    act(() => { editor().commands.setTextSelection({ from: 9, to: 16 }) })
    fireEvent.keyUp(editorElement(), { key: 'Shift' })

    await waitFor(() => expect(editorElement()).not.toHaveClass('paint-format-active'), { timeout: 1500 })
    expect(editor().getHTML()).toContain('<strong>Destino</strong>')
  })

  it('ignores clicks that start outside the editor', async () => {
    await renderApp()
    act(() => {
      editor().commands.setContent('<p><strong>Origem</strong></p><p>Destino</p>', true)
      editor().commands.setTextSelection({ from: 1, to: 7 })
    })
    pressPaintButton()
    await waitFor(() => expect(editorElement()).toHaveClass('paint-format-active'))

    act(() => {
      editor().commands.setTextSelection({ from: 9, to: 16 })
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1 }))
      document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
    })

    expect(editorElement()).toHaveClass('paint-format-active')
    expect(editor().getHTML()).not.toContain('<strong>Destino</strong>')
  })
})

describe('App: persistência local', () => {
  it('autosaves the document after an edit', async () => {
    await renderApp()
    const before = Date.now()
    act(() => { editor().commands.insertContent(' texto novo') })

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      expect(saved.length).toBeGreaterThan(0)
      expect(saved[0].content).toContain('texto novo')
      expect(saved[0].updatedAt).toBeGreaterThanOrEqual(before)
    }, { timeout: 4000 })
  })
})
