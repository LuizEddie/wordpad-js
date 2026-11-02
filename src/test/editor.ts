import { Editor } from '@tiptap/core'
import { createWordpadExtensions } from '../App'

/**
 * Creates a real TipTap editor with the same schema as the app, attached to a
 * detached DOM node. Model-level tests use this instead of mounting the whole
 * interface, which keeps them fast and independent from layout.
 */
export function createTestEditor(content = '<p></p>'): Editor {
  const element = document.createElement('div')
  document.body.appendChild(element)
  return new Editor({ element, extensions: createWordpadExtensions(), content })
}

export function destroyTestEditor(editor: Editor) {
  const element = editor.view.dom.parentElement
  editor.destroy()
  element?.remove()
}

export function select(editor: Editor, from: number, to = from) {
  editor.commands.setTextSelection({ from, to })
}
