import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import '../organizations/OrganizationMembers.css'

type Props = {
  organizationId: string
  interviewId: string
}

export default function InviteCandidate({
  organizationId,
  interviewId,
}: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submitting = useRef(false)

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting.current) return

    setError('')
    setMessage('')

    const cleanEmail = email.trim().toLowerCase()

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setError('Enter a valid email address.')
      return
    }

    submitting.current = true
    setSaving(true)

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
          body: JSON.stringify({ email: cleanEmail }),
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

      setEmail('')
      setMessage(
        `Invitation created for ${cleanEmail}. They can sign in and accept it from Dashboard → Invitations.`,
      )
    } catch {
      setError(
        'Unable to confirm whether the invitation was created. Retrying will replace any previous unused invitation.',
      )
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <section
      className="members-add"
      aria-labelledby="invite-candidate-title"
    >
      <h3 id="invite-candidate-title">Invite a candidate</h3>

      <p>
        The invitation will appear in the candidate’s account when they sign
        in with this email address. They must accept before joining the
        interview. Creating another invitation replaces the previous unused
        invitation.
      </p>

      <form onSubmit={handleInvite}>
        <label htmlFor="candidate-email">Candidate email</label>

        <div className="members-form-row">
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
        </div>
      </form>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="members-success" role="status">
          {message}
        </p>
      )}
    </section>
  )
}