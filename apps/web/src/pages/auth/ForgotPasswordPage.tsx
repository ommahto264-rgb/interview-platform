import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import '../../App.css'

type Step = 'email' | 'reset' | 'done'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || step === 'done') return
    setError('')

    const requestingCode = step === 'email'

    if (!requestingCode && password !== confirmation) {
      setError('Your passwords do not match.')
      return
    }

    const cleanEmail = email.trim().toLowerCase()
    const endpoint = requestingCode ? 'forgot-password' : 'reset-password'
    const body = requestingCode
      ? { email: cleanEmail }
      : { email: cleanEmail, code: code.trim(), newPassword: password }

    setBusy(true)
    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'Unable to complete the request. Please try again.')
        return
      }

      if (requestingCode) {
        setStep('reset')
      } else {
        setCode('')
        setPassword('')
        setConfirmation('')
        setStep('done')
      }
    } catch {
      setError('Unable to reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function backToEmail() {
    setError('')
    setCode('')
    setPassword('')
    setConfirmation('')
    setStep('email')
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="brand"><Link to="/">Interview Platform</Link></p>

        {step === 'done' ? (
          <>
            <h1>Password changed</h1>
            <p className="success-message" role="status">
              Your new password is ready. Use it the next time you sign in.
            </p>
            <Link to="/login">Continue to sign in →</Link>
          </>
        ) : (
          <>
            <h1>{step === 'email' ? 'Forgot password?' : 'Reset your password'}</h1>
            <p className="subtitle">
              {step === 'email'
                ? 'Enter the email you verified on Interview Platform.'
                : `If ${email.trim()} belongs to a verified account, check its inbox for a reset code. The code expires in 15 minutes.`}
            </p>

            <form onSubmit={handleSubmit}>
              {step === 'email' ? (
                <>
                  <label htmlFor="recovery-email">Email address</label>
                  <input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    maxLength={254}
                    disabled={busy}
                    required
                  />
                </>
              ) : (
                <>
                  <label htmlFor="reset-code">Reset code</label>
                  <input
                    id="reset-code"
                    type="text"
                    autoComplete="one-time-code"
                    spellCheck={false}
                    placeholder="Paste the code from your email"
                    value={code}
                    onChange={event => setCode(event.target.value)}
                    disabled={busy}
                    required
                  />

                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="reset-password-help"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    disabled={busy}
                    required
                  />
                  <p id="reset-password-help" className="subtitle">
                    Use 8–128 characters, including an uppercase letter and a special character.
                  </p>

                  <label htmlFor="confirm-new-password">Confirm new password</label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={event => setConfirmation(event.target.value)}
                    disabled={busy}
                    required
                  />
                </>
              )}

              {error && <p className="error-message" role="alert">{error}</p>}

              <button type="submit" disabled={busy}>
                {step === 'email'
                  ? (busy ? 'Requesting code…' : 'Send reset code')
                  : (busy ? 'Changing password…' : 'Change password')}
              </button>
            </form>

            {step === 'reset' && (
              <p>
                <button type="button" onClick={backToEmail} disabled={busy}>
                  Change email or request another code
                </button>
              </p>
            )}

            <p><Link to="/login">← Back to sign in</Link></p>
          </>
        )}
      </section>
    </main>
  )
}