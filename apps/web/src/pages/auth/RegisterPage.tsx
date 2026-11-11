import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import '../../App.css'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    setError('')

    const cleanName = name.trim()

    if (cleanName.length < 2 || cleanName.length > 100) {
      setError('Name must contain between 2 and 100 characters.')
      return
    }

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
      setRegistered(true)
    } catch {
      setError('Unable to reach the server. Please try again.')
    } finally {
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
                placeholder="Create a strong password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={15}
                maxLength={128}
                aria-describedby="password-help"
                required
                disabled={loading}
              />

              <p id="password-help" className="subtitle">
                Use 15–128 characters. A long, memorable passphrase works well.
              </p>

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