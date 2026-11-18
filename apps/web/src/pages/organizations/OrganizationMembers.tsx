import { apiFetch } from '../../lib/apiFetch'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './OrganizationMembers.css'

type Member = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'INTERVIEWER'
}

type Invitation = {
  id: string
  email: string
  role: 'INTERVIEWER'
  created_at: string
  expires_at: string
  status: 'PENDING' | 'EXPIRED'
}

type Props = {
  organizationId: string
}

export default function OrganizationMembers({ organizationId }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  const actionInProgress = useRef(false)

  const baseUrl =
    `/api/organizations/${encodeURIComponent(organizationId)}`

  useEffect(() => {
    const controller = new AbortController()

    async function loadTeam() {
      setLoading(true)
      setLoadError('')

      try {
        const options: Parameters<typeof apiFetch>[1] = {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        }

        const [membersResponse, invitationsResponse] = await Promise.all([
          apiFetch(`${baseUrl}/members`, options),
          apiFetch(`${baseUrl}/invitations`, options),
        ])

        const responses = [membersResponse, invitationsResponse]

        if (responses.some((response) => response.status === 401)) {
          throw new Error('Your session expired. Please sign in again.')
        }

        if (responses.some((response) => response.status === 403)) {
          throw new Error('Administrator access is required.')
        }

        if (responses.some((response) => !response.ok)) {
          throw new Error('Unable to load your team. Please try again.')
        }

        const [memberData, invitationData] = await Promise.all([
          membersResponse.json(),
          invitationsResponse.json(),
        ])

        if (
          !Array.isArray(memberData.members) ||
          !Array.isArray(invitationData.invitations)
        ) {
          throw new Error('The server returned an unexpected response.')
        }

        if (controller.signal.aborted) return

        setMembers(memberData.members)
        setInvitations(invitationData.invitations)
      } catch (error) {
        if (controller.signal.aborted) return

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load your team.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadTeam()

    return () => controller.abort()
  }, [baseUrl, attempt])

  async function updateInvitation(
    action: 'invite' | 'cancel',
    recipientEmail = '',
    invitationId = '',
  ) {
    if (actionInProgress.current) return

    actionInProgress.current = true
    setBusy(true)
    setActionError('')
    setMessage('')

    try {
      const url =
        action === 'invite'
          ? `${baseUrl}/invitations`
          : `${baseUrl}/invitations/${encodeURIComponent(invitationId)}/revoke`

      const response = await apiFetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body:
          action === 'invite'
            ? JSON.stringify({
                email: recipientEmail.trim().toLowerCase(),
              })
            : undefined,
      })

      if (response.status === 401) {
        setActionError('Your session expired. Please sign in again.')
        return
      }

      if (response.status === 403) {
        setActionError('Administrator access is required.')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setActionError(data.error ?? 'Unable to update the invitation.')

        if (response.status === 404 || response.status === 409) {
          setAttempt((value) => value + 1)
        }

        return
      }

      if (action === 'invite') {
        setEmail('')
        setMessage(
          `Invitation created for ${recipientEmail.trim().toLowerCase()}. They can sign in and accept it from Dashboard → Invitations.`,
        )
      } else {
        setMessage('Invitation cancelled successfully.')
      }

      setAttempt((value) => value + 1)
    } catch {
      setActionError(
        'Unable to confirm the update. Refresh the invitation list before retrying.',
      )
    } finally {
      actionInProgress.current = false
      setBusy(false)
    }
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (actionInProgress.current) return

    setActionError('')
    setMessage('')

    const cleanEmail = email.trim().toLowerCase()

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setActionError('Enter a valid email address.')
      return
    }

    void updateInvitation('invite', cleanEmail)
  }

  function renewInvitation(invitation: Invitation) {
    const confirmed = window.confirm(
      `Renew the invitation for ${invitation.email}? This replaces the previous invitation and starts a new seven-day expiry.`,
    )

    if (confirmed) {
      void updateInvitation('invite', invitation.email)
    }
  }

  function cancelInvitation(invitation: Invitation) {
    const confirmed = window.confirm(
      `Cancel the invitation for ${invitation.email}?`,
    )

    if (confirmed) {
      void updateInvitation('cancel', '', invitation.id)
    }
  }

  return (
    <section
      className="organization-members"
      aria-labelledby="members-title"
    >
      <div className="members-toolbar">
        <div>
          <h2 id="members-title">Your team</h2>
          <p>Invite interviewers and manage pending invitations.</p>
        </div>

        <button
          type="button"
          className="workspace-refresh"
          disabled={loading || busy}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {loading ? 'Loading…' : 'Refresh members'}
        </button>
      </div>

      <section
        className="members-add"
        aria-labelledby="invite-member-title"
      >
        <h3 id="invite-member-title">Invite an interviewer</h3>

        <p>
          The invitation will appear in their account when they sign in with
          this email address. They must accept before receiving organization
          access. Invitations expire after seven days.
        </p>

        <form onSubmit={handleInvite}>
          <label htmlFor="member-email">Email address</label>

          <div className="members-form-row">
            <input
              id="member-email"
              name="email"
              type="email"
              autoComplete="off"
              placeholder="interviewer@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              disabled={busy}
              required
            />

            <button type="submit" disabled={busy}>
              {busy ? 'Please wait…' : 'Create invitation'}
            </button>
          </div>
        </form>

        {actionError && (
          <p className="error-message" role="alert">
            {actionError}
          </p>
        )}

        {message && (
          <p className="members-success" role="status">
            {message}
          </p>
        )}
      </section>

      {loading ? (
        <p role="status">Loading members and invitations…</p>
      ) : loadError ? (
        <div role="alert">
          <p className="error-message">{loadError}</p>

          <button
            type="button"
            className="workspace-refresh"
            disabled={busy}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="members-table-container">
            <table className="members-table">
              <caption>
                {members.length} organization{' '}
                {members.length === 1 ? 'member' : 'members'}
              </caption>

              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>

              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No members to display.</td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id}>
                      <th scope="row">{member.name}</th>
                      <td>{member.email}</td>
                      <td>
                        <span className="workspace-role">
                          {member.role === 'ADMIN'
                            ? 'Administrator'
                            : 'Interviewer'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <section aria-labelledby="pending-invitations-title">
            <h2 id="pending-invitations-title">Pending invitations</h2>

            {invitations.length === 0 ? (
              <p>No pending invitations.</p>
            ) : (
              <div className="members-table-container">
                <table className="members-table">
                  <caption>
                    Latest {invitations.length} open invitations, up to 100.
                    Renewing replaces the previous invitation and starts a
                    new seven-day expiry.
                  </caption>

                  <thead>
                    <tr>
                      <th scope="col">Email</th>
                      <th scope="col">Status</th>
                      <th scope="col">Expires</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <th scope="row">{invitation.email}</th>

                        <td>
                          {invitation.status === 'PENDING'
                            ? 'Awaiting acceptance'
                            : 'Expired'}
                        </td>

                        <td>
                          <time dateTime={invitation.expires_at}>
                            {new Date(invitation.expires_at).toLocaleString()}
                          </time>
                        </td>

                        <td>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <button
                              type="button"
                              className="workspace-refresh"
                              disabled={busy}
                              onClick={() => renewInvitation(invitation)}
                            >
                              Renew invitation
                            </button>

                            <button
                              type="button"
                              className="workspace-refresh"
                              disabled={busy}
                              onClick={() => cancelInvitation(invitation)}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}