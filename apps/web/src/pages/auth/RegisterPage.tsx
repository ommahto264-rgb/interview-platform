import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import '../../App.css'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const [loading, setLoading] = useState(false)

  const submitting = useRef(false)

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting.current) return

    setError('')

    const cleanName = name.trim()

    if (cleanName.length < 2 || cleanName.length > 100) {
      setError('Name must contain between 2 and 100 characters.')
      return
    }

    if (password.length < 8 || password.length > 128) {
      setError('Password must contain between 8 and 128 characters.')
      return
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter.')
      return
    }

    if (!/[\p{P}\p{S}]/u.test(password)) {
      setError('Password must contain at least one special character.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    submitting.current = true
    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cleanName,
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Unable to create your account.')
        return
      }

      setPassword('')
      setConfirmPassword('')
      setRegistered(true)
    } catch {
      setError(
        'Unable to confirm registration. Try signing in before registering again.',
      )
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="brand">
          <Link to="/">Interview Platform</Link>
        </p>

        {registered ? (
          <>
            <h1>Account created</h1>

            <p className="success-message" role="status">
              Your account was created successfully. You can now sign in.
            </p>

            <Link to="/login">Continue to sign in →</Link>
          </>
        ) : (
          <>
            <h1>Create your account</h1>

            <p className="subtitle">
              Join your interviews or organize them for your team.
            </p>

            <form onSubmit={handleRegister}>
              <label htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={100}
                required
                disabled={loading}
              />

              <label htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
                disabled={loading}
              />

              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={128}
                aria-describedby="password-help"
                required
                disabled={loading}
              />

              <p
                id="password-help"
                style={{
                  margin: '8px 0 16px',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  color: '#a7b5ad',
                }}
              >
                8–128 characters, including an uppercase letter and a
                special character such as !, @, or #.
              </p>

              <label htmlFor="register-confirm-password">
                Confirm password
              </label>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                maxLength={128}
                required
                disabled={loading}
              />

              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </section>
    </main>
  )
}