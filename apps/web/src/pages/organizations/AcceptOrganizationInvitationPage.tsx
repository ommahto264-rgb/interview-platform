import { apiFetch } from '../../lib/apiFetch'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

export default function AcceptOrganizationInvitationPage() {
  const [token] = useState(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1))
    return parameters.get('token') ?? ''
  })

  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [error, setError] = useState('')

  const submitting = useRef(false)
  const validToken = /^[0-9a-f]{64}$/.test(token)

  async function acceptInvitation() {
    if (!validToken || submitting.current || accepted) return

    submitting.current = true
    setLoading(true)
    setError('')
    setNeedsLogin(false)

    try {
      const response = await apiFetch('/api/organization-invitations/accept', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      if (response.status === 401) {
        setNeedsLogin(true)
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Unable to accept this invitation.')
        return
      }

      setAccepted(true)

      // Remove the used token from the address bar.
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      )
    } catch {
      setError(
        'Unable to confirm acceptance. Check your dashboard first. If the organization is missing, return to this link and try again.',
      )
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="brand">Interview Platform</p>

        {accepted ? (
          <>
            <h1>You’re on the team.</h1>

            <p className="subtitle" role="status">
              Invitation accepted. You now have Interviewer access to this
              organization.
            </p>

            <Link className="workspace-refresh" to="/dashboard">
              Open dashboard →
            </Link>
          </>
        ) : !validToken ? (
          <>
            <h1>Invalid invitation link.</h1>

            <p className="subtitle" role="alert">
              This link is missing a valid invitation token. Ask the
              organization administrator for a new link.
            </p>

            <Link to="/dashboard">Back to dashboard →</Link>
          </>
        ) : (
          <>
            <h1>Join your team.</h1>

            <p className="subtitle">
              Accept this invitation to join an organization as an interviewer.
              You must sign in using the email address that was invited.
            </p>

            {needsLogin && (
              <div role="status" style={{ marginBottom: '20px' }}>
                <p>
                  Sign in or create an account first. These links open a new
                  tab. Once you’re signed in, return here and click Accept
                  invitation again.
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '20px',
                  }}
                >
                  <Link to="/login" target="_blank" rel="noopener noreferrer">
                    Sign in ↗
                  </Link>

                  <Link
                    to="/register"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Create account ↗
                  </Link>
                </div>
              </div>
            )}

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              className="workspace-refresh"
              disabled={loading}
              onClick={() => void acceptInvitation()}
            >
              {loading ? 'Accepting…' : 'Accept invitation'}
            </button>

            <p style={{ marginTop: '24px' }}>
              <Link to="/dashboard">Back to dashboard →</Link>
            </p>
          </>
        )}
      </section>
    </main>
  )
}