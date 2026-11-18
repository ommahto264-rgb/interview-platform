import { apiFetch } from '../../lib/apiFetch'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Editor from '@monaco-editor/react'
import '../../lib/monaco'

type Props = {
  candidateId: string
  interviewId: string
  versionId: string
  starterCode: string
  onSubmitted: (executionUrl: string) => void
}

type SubmissionAttempt = {
  sourceCode: string
  key: string
}

type DraftState = {
  sourceCode: string
  status: string
}

function readDraft(key: string, starterCode: string): DraftState {
  try {
    const savedCode = sessionStorage.getItem(key)

    if (savedCode !== null) {
      return {
        sourceCode: savedCode,
        status: 'Draft restored from this tab.',
      }
    }

    return {
      sourceCode: starterCode,
      status: 'Changes are saved automatically in this tab.',
    }
  } catch {
    return {
      sourceCode: starterCode,
      status: 'Draft storage is unavailable. Copy your code before refreshing.',
    }
  }
}

export default function CodeEditor({
  candidateId,
  interviewId,
  versionId,
  starterCode,
  onSubmitted,
}: Props) {
  const draftKey =
    `interview-platform:draft:v1:${candidateId}:${interviewId}:${versionId}`

  const [draft, setDraft] = useState<DraftState>(() =>
    readDraft(draftKey, starterCode),
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submitting = useRef(false)
  const pendingAttempt = useRef<SubmissionAttempt | null>(null)

  const sourceCode = draft.sourceCode
  const codeBytes = new TextEncoder().encode(sourceCode).length
  const maxBytes = 10 * 1024

  function handleCodeChange(value: string | undefined) {
    // Monaco can briefly provide undefined during initialization.
    if (value === undefined) return

    let status = 'Draft saved in this tab.'

    try {
      // Save immediately so a quick refresh does not lose the latest edit.
      // An empty string is a valid draft and must also be preserved.
      sessionStorage.setItem(draftKey, value)
    } catch {
      status = 'Draft could not be saved. Copy your code before refreshing.'
    }

    setDraft({
      sourceCode: value,
      status,
    })

    setMessage('')
  }

  function resetCode() {
    if (submitting.current) return

    const confirmed = window.confirm(
      'Replace your current solution with the starter code?',
    )

    if (!confirmed) return

    handleCodeChange(starterCode)
    pendingAttempt.current = null
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting.current) return

    setError('')
    setMessage('')

    if (!sourceCode.trim()) {
      setError('Write your solution before submitting.')
      return
    }

    if (codeBytes > maxBytes) {
      setError('Your solution must be no larger than 10 KiB.')
      return
    }

    // Reuse the key when retrying unchanged code after an uncertain response.
    if (
      !pendingAttempt.current ||
      pendingAttempt.current.sourceCode !== sourceCode
    ) {
      pendingAttempt.current = {
        sourceCode,
        key: crypto.randomUUID(),
      }
    }

    const attempt = pendingAttempt.current

    submitting.current = true
    setSaving(true)

    try {
      const response = await apiFetch(
        `/api/candidate/interviews/${encodeURIComponent(interviewId)}/submissions`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': attempt.key,
          },
          body: JSON.stringify({
            sourceCode: attempt.sourceCode,
          }),
        },
      )

      if (!response.ok) {
        if (response.status === 401) {
          setError(
            'Your session expired. Keep this page open and sign in ' +
              'in another tab before retrying.',
          )
          return
        }

        if (response.status === 429) {
          setError('Too many submissions. Wait a few seconds and try again.')
          return
        }

        const data = await response.json()

        setError(data.error ?? 'Unable to submit your code.')
        return
      }

      const executionUrl = response.headers.get('Location')

      if (!executionUrl) {
        setError(
          'The server accepted the submission but did not return its ' +
            'execution URL. Your code is still in the editor.',
        )
        return
      }

      pendingAttempt.current = null
      setMessage('Code submitted. Execution queued.')

      // Keep the draft so the candidate can continue editing.
      onSubmitted(executionUrl)
    } catch {
      setError(
        'Unable to confirm the submission. Your code is still here. ' +
          'Retrying unchanged code without reloading will reuse the same request key.',
      )
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <section className="challenge-panel" aria-labelledby="solution-title">
      <div className="challenge-panel-heading">
        <h2 id="solution-title">Your solution</h2>
        <span className="workspace-role">JavaScript</span>
      </div>

      <p className="workspace-description">
        Implement the solve function using the arguments described in
        the challenge. Your code runs on the server when you submit.
      </p>

      <form onSubmit={handleSubmit}>
        <p className="candidate-editor-label">JavaScript source code</p>

        <div className="candidate-monaco">
          <Editor
            height="100%"
            language="javascript"
            theme="interview-dark"
            value={sourceCode}
            onChange={handleCodeChange}
            loading={
              <p className="workspace-description">
                Loading code editor…
              </p>
            }
            options={{
              ariaLabel: 'JavaScript solution editor',
              readOnly: saving,
              automaticLayout: true,
              fontFamily: '"Cascadia Code", Consolas, monospace',
              fontSize: 14,
              lineHeight: 24,
              minimap: { enabled: false },
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              insertSpaces: true,
              lineNumbers: 'on',
              roundedSelection: true,
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              formatOnType: true,
              renderLineHighlight: 'line',
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        </div>

        <p id="candidate-code-size" className="workspace-description">
          {codeBytes.toLocaleString()} / {maxBytes.toLocaleString()} bytes
        </p>

        <p className="workspace-description" role="status">
          {draft.status}
        </p>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="workspace-description" role="status">
            {message}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <button
            type="button"
            className="workspace-refresh"
            disabled={saving}
            onClick={resetCode}
          >
            Reset code
          </button>

          <button
            type="submit"
            disabled={saving || !sourceCode.trim() || codeBytes > maxBytes}
          >
            {saving ? 'Submitting…' : 'Submit solution'}
          </button>
        </div>
      </form>
    </section>
  )
}