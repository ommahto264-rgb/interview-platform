import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import TypeScriptWorker from 'monaco-editor/languages/features/typescript/ts.worker.js?worker'

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === 'javascript' || label === 'typescript') {
      return new TypeScriptWorker()
    }

    return new EditorWorker()
  },
}

monaco.editor.defineTheme('interview-dark', {
  base: 'vs-dark',
  inherit: true,

  rules: [
    { token: 'comment', foreground: '81958A', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'EF8588' },
    { token: 'string', foreground: 'B8D9A4' },
    { token: 'number', foreground: 'E6BC86' },
    { token: 'type.identifier', foreground: '8CCFC1' },
    { token: 'delimiter', foreground: 'C7D2CA' },
  ],

  colors: {
    'editor.background': '#08130F',
    'editor.foreground': '#F2F0E9',
    'editorLineNumber.foreground': '#63796C',
    'editorLineNumber.activeForeground': '#F2F0E9',
    'editorCursor.foreground': '#F2F0E9',
    'editor.selectionBackground': '#345746',
    'editor.inactiveSelectionBackground': '#243D31',
    'editor.lineHighlightBackground': '#11231A',
    'editorIndentGuide.background1': '#20382A',
    'editorIndentGuide.activeBackground1': '#52705B',
    'editorWidget.background': '#132019',
    'editorWidget.border': '#293A32',
    'editorSuggestWidget.background': '#132019',
    'editorSuggestWidget.border': '#293A32',
    'editorSuggestWidget.selectedBackground': '#294334',
    'editorGutter.background': '#08130F',
    'scrollbarSlider.background': '#526B5B55',
    'scrollbarSlider.hoverBackground': '#526B5B88',
    'scrollbarSlider.activeBackground': '#526B5BAA',
  },
})

loader.config({ monaco })