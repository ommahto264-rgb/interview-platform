import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import './VerifyEmailPanel.css'

const baseUrl = '/api/auth/email-verification'

type View = 'loading' | 'unverified' | 'verified' | 'error'

export default function VerifyEmailPanel() {
  const [view, setView] = useState<View>('loading')
  const [attempt, setAttempt] = useState(0)
  const [showCode, setShowCode] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'send' | 'confirm' | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let ignore = false

    async function checkStatus() {
      try {
        const response = await apiFetch(`${baseUrl}/status`, {
          cache: 'no-store',
        })
        if (!response.ok) throw new Error()

        const data = await response.json()
        if (typeof data.verified !== 'boolean') throw new Error()

        if (!ignore) setView(data.verified ? 'verified' : 'unverified')
      } catch {
        if (!ignore) setView('error')
      }
    }

    void checkStatus()
    return () => { ignore = true }
  }, [attempt])

  async function sendCode() {
    if (busy) return
    setBusy('send')
    setError('')
    setMessage('')

    try {
      const response = await apiFetch(`${baseUrl}/request`, {
        method: 'POST',
      })
      const data = await response.json()

      // A code from an earlier request can still be entered.
      if (response.status === 429) setShowCode(true)
      if (!response.ok) throw new Error(data.error || 'Unable to send the code.')

      // The backend returns 200 if already verified, 202 if it sent a code.
      if (response.status === 200) {
        setView('verified')
      } else {
        setShowCode(true)
        setMessage('Check your inbox. The code expires in 15 minutes.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send the code.')
    } finally {
      setBusy(null)
    }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy('confirm')
    setError('')
    setMessage('')

    try {
      const response = await apiFetch(`${baseUrl}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Unable to verify the code.')
      }

      setCode('')
      setMessage('Your email is verified.')
      setView('verified')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify the code.')
    } finally {
      setBusy(null)
    }
  }

    if (view === 'loading') return null

  if (view === 'verified') {
    return message ? (
      <p className="email-verify-success" role="status">
        <span aria-hidden="true">✓</span> {message}
      </p>
    ) : null
  }

  if (view === 'error') {
    return (
      <section className="email-verify" aria-label="Email verification">
        <p className="email-verify-note" role="alert">
          We couldn’t check whether your email is verified.
        </p>
        <button
          className="email-verify-secondary"
          type="button"
          onClick={() => setAttempt(n => n + 1)}
        >
          Try again
        </button>
      </section>
    )
  }

  return (
    <section className="email-verify" aria-labelledby="verify-email-title">
      <div className="email-verify-copy">
        <h2 id="verify-email-title">
          {showCode ? 'Enter your verification code' : 'Verify your email'}
        </h2>
        <p className="email-verify-note">
          {showCode
            ? 'Paste the 16-character code from your email. Hyphens are fine.'
            : 'Confirm your email so you can accept team and interview invitations.'}
        </p>
      </div>

      {showCode ? (
        <form className="email-verify-form" onSubmit={confirmCode}>
          <label htmlFor="email-code">Verification code</label>
          <div className="email-verify-entry">
            <input
              id="email-code"
              name="code"
              type="text"
              autoComplete="one-time-code"
              spellCheck={false}
              autoCapitalize="characters"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={code}
              onChange={event => setCode(event.target.value)}
              maxLength={19}
              required
              autoFocus
            />
            <button
              className="email-verify-primary"
              type="submit"
              disabled={busy !== null || !code.trim()}
            >
              {busy === 'confirm' ? 'Verifying…' : 'Verify email'}
            </button>
          </div>
          <button
            className="email-verify-secondary"
            type="button"
            disabled={busy !== null}
            onClick={sendCode}
          >
            {busy === 'send' ? 'Sending…' : 'Resend code'}
          </button>
        </form>
      ) : (
        <div className="email-verify-actions">
          <button
            className="email-verify-primary"
            type="button"
            disabled={busy !== null}
            onClick={sendCode}
          >
            {busy === 'send' ? 'Sending…' : 'Send code'}
          </button>
          <button
            className="email-verify-secondary"
            type="button"
            disabled={busy !== null}
            onClick={() => setShowCode(true)}
          >
            I have a code
          </button>
        </div>
      )}

      {error && <p className="email-verify-feedback is-error" role="alert">{error}</p>}
      {message && <p className="email-verify-feedback" role="status">{message}</p>}
    </section>
  )
}