import { useState } from 'react'
import type { FormEvent } from 'react'

type Props = {
  organizationId: string
  interviewId: string
}

export default function InviteCandidate({
  organizationId,
  interviewId,
}: Props) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) return

    setSaving(true)
    setError('')
    setMessage('')
    setToken('')

    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}` +
          `/interviews/${encodeURIComponent(interviewId)}/invitations`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        },
      )

      if (response.status === 401) {
        setError('Your session has expired. Please sign in again.')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Unable to create the invitation.')
        return
      }

      if (typeof data.invitationToken !== 'string') {
        setError('The server did not return an invitation token.')
        return
      }

      setToken(data.invitationToken)
      setMessage('Invitation created for local testing. No email was sent.')
    } catch {
      setError(
        'Unable to confirm whether the invitation was created. Retrying will replace any previous unused invitation.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token)
      setMessage('Invitation token copied.')
    } catch {
      setMessage('Select the token below and copy it manually.')
    }
  }

  return (
    <section className="challenge-panel" aria-labelledby="invite-title">
      <p className="workspace-eyebrow">Candidate access</p>
      <h2 id="invite-title">Invite a candidate</h2>

      <p className="workspace-description">
        The candidate must accept using an account with this email address.
        Creating a new invitation replaces any previous unused invitation.
      </p>

      <form onSubmit={handleInvite}>
        <label htmlFor="candidate-email">Candidate email</label>

        <input
          id="candidate-email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="candidate@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
          disabled={saving}
        />

        <button type="submit" disabled={saving}>
          {saving ? 'Creating invitation…' : 'Create invitation'}
        </button>
      </form>

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

      {token && (
        <div>
          <label htmlFor="invitation-token">Local testing token</label>

          <textarea
            id="invitation-token"
            value={token}
            readOnly
            rows={3}
            spellCheck={false}
          />

          <button type="button" onClick={() => void copyToken()}>
            Copy token
          </button>
        </div>
      )}
    </section>
  )
}