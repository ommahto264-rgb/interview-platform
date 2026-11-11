import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'

import './InterviewDetailsPage.css'

export default function AcceptInvitationPage() {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  async function handleAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving || accepted) return

    const invitationToken = token.trim()

    if (!/^[a-f0-9]{64}$/.test(invitationToken)) {
      setError('Paste the complete 64-character invitation token.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: invitationToken,
        }),
      })

      if (response.status === 401) {
        setError(
          'Please sign in with the invited email address, then return here.',
        )
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Unable to accept the invitation.')
        return
      }

      setToken('')
      setAccepted(true)
    } catch {
      setError(
        'Unable to confirm acceptance. Check My interviews on your dashboard before trying again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Link to="/" className="workspace-brand">
          <span className="workspace-monogram" aria-hidden="true">
            IP
          </span>

          <span>
            INTERVIEW
            <small>PLATFORM</small>
          </span>
        </Link>

        <div className="workspace-sidebar-body">
          <p className="workspace-nav-label">Candidate access</p>

          <div className="workspace-sidebar-note">
            <span className="workspace-note-line" aria-hidden="true" />
            <p>Your next conversation starts here.</p>
          </div>
        </div>

        <div className="workspace-sidebar-footer">
          <Link to="/dashboard">← Back to dashboard</Link>
        </div>
      </aside>

      <div className="workspace-content">
        <header className="workspace-topbar">
          <p>
            <Link to="/dashboard">Dashboard</Link>
            <span aria-hidden="true">/</span>
            <strong>Accept invitation</strong>
          </p>
        </header>

        <main className="workspace-main">
          <section className="workspace-heading">
            <div>
              <p className="workspace-eyebrow">Your interview invitation</p>
              <h1>Take your seat.</h1>
              <p className="workspace-description">
                Accept your invitation using the account associated with
                the invited email address.
              </p>
            </div>
          </section>

          <div className="interview-actions interview-invitation">
            <section className="challenge-panel">
              {accepted ? (
                <div role="status">
                  <h2>Invitation accepted.</h2>
                  <p className="workspace-description">
                    Your interview is now available under My interviews
                    on your dashboard.
                  </p>
                  <Link to="/dashboard">Go to dashboard →</Link>
                </div>
              ) : (
                <>
                  <h2>Accept your invitation</h2>
                  <p className="workspace-description">
                    For local testing, paste the token provided by the
                    interviewer.
                  </p>

                  <form onSubmit={handleAccept}>
                    <label htmlFor="accept-token">Invitation token</label>

                    <textarea
                      id="accept-token"
                      name="token"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder="Paste your invitation token"
                      rows={3}
                      required
                      disabled={saving}
                      autoComplete="off"
                      spellCheck={false}
                    />

                    {error && (
                      <p className="error-message" role="alert">
                        {error}
                      </p>
                    )}

                    <button type="submit" disabled={saving}>
                      {saving ? 'Accepting…' : 'Accept invitation'}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}