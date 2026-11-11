import Editor from '@monaco-editor/react'
import '../../lib/monaco'

type Props = {
  sourceCode: string
}

export default function SubmissionCode({ sourceCode }: Props) {
  return (
    <Editor
      height="100%"
      language="javascript"
      theme="interview-dark"
      value={sourceCode}
      loading={<p className="review-muted">Loading code viewer…</p>}
      options={{
        ariaLabel: 'Candidate submitted JavaScript, read only',
        readOnly: true,
        domReadOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        fontFamily: '"Cascadia Code", Consolas, monospace',
        fontSize: 14,
        lineHeight: 24,
        padding: { top: 16, bottom: 16 },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'none',
        folding: true,
        tabSize: 2,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
    />
  )
}