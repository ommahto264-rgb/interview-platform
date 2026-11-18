import { apiFetch } from '../../lib/apiFetch'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

type OrganizationInvitation = {
  id: string
  organization_name: string
  role: 'INTERVIEWER'
  created_at: string
  expires_at: string
}

type InterviewInvitation = {
  id: string
  interview_title: string
  organization_name: string
  scheduled_start_at: string
  scheduled_end_at: string
  expires_at: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AcceptInvitationPage() {
  const navigate = useNavigate()

  const [organizations, setOrganizations] =
    useState<OrganizationInvitation[]>([])
  const [interviews, setInterviews] =
    useState<InterviewInvitation[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [accepting, setAccepting] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const submitting = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadInvitations() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await apiFetch('/api/invitation-inbox', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (response.status === 401) {
          void navigate('/login', { replace: true })
          return
        }

        if (!response.ok) {
          throw new Error('Unable to load invitations. Please try again.')
        }

        const data = await response.json()

        if (
          !Array.isArray(data.organizationInvitations) ||
          !Array.isArray(data.interviewInvitations)
        ) {
          throw new Error('The server returned an unexpected response.')
        }

        if (controller.signal.aborted) return

        setOrganizations(data.organizationInvitations)
        setInterviews(data.interviewInvitations)
      } catch (error) {
        if (controller.signal.aborted) return

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to reach the server.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadInvitations()

    return () => controller.abort()
  }, [attempt, navigate])

  async function acceptInvitation(
    kind: 'organizations' | 'interviews',
    id: string,
  ) {
    if (submitting.current) return

    submitting.current = true
    setAccepting(`${kind}:${id}`)
    setActionError('')
    setMessage('')

    try {
      const response = await apiFetch(
        `/api/invitation-inbox/${kind}/${encodeURIComponent(id)}/accept`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )

      if (response.status === 401) {
        void navigate('/login', { replace: true })
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setActionError(data.error ?? 'Unable to accept this invitation.')

        // Refresh invitations that became unavailable while this page was open.
        if (response.status === 404 || response.status === 409) {
          setAttempt((value) => value + 1)
        }

        return
      }

      if (kind === 'organizations') {
        setOrganizations((items) => items.filter((item) => item.id !== id))
        setMessage(
          'Invitation accepted. The organization is now available on your dashboard.',
        )
      } else {
        setInterviews((items) => items.filter((item) => item.id !== id))
        setMessage(
          'Invitation accepted. Open My interviews on your dashboard to see it.',
        )
      }
    } catch {
      setActionError(
        'Unable to confirm acceptance. Check your dashboard or refresh invitations before retrying.',
      )
    } finally {
      submitting.current = false
      setAccepting(null)
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
          <p className="workspace-nav-label">Your workspace</p>

          <nav className="workspace-nav" aria-label="Workspace navigation">
            <Link to="/dashboard">Dashboard</Link>
            <Link
              to="/invitations/accept"
              className="is-active"
              aria-current="page"
            >
              Invitations
            </Link>
          </nav>

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
            <Link to="/dashboard">Workspace</Link>
            <span aria-hidden="true">/</span>
            <strong>Invitations</strong>
          </p>
        </header>

        <main className="workspace-main">
          <section className="workspace-heading">
            <div>
              <p className="workspace-eyebrow">Your next opportunity</p>
              <h1>
                Invitations<span>.</span>
              </h1>
              <p className="workspace-description">
                Join an interview team or accept your next interview.
                Only invitations addressed to your account appear here.
              </p>
            </div>

            <button
              type="button"
              className="workspace-refresh"
              disabled={loading || accepting !== null}
              onClick={() => setAttempt((value) => value + 1)}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </section>

          {message && (
            <div className="workspace-state" role="status">
              <p>{message}</p>
              <Link to="/dashboard">Open dashboard →</Link>
            </div>
          )}

          {actionError && (
            <p className="error-message" role="alert">
              {actionError}
            </p>
          )}

          {loading ? (
            <p role="status">Loading your invitations…</p>
          ) : loadError ? (
            <div className="workspace-state" role="alert">
              <h2>Unable to load invitations.</h2>
              <p>{loadError}</p>
              <button
                type="button"
                className="workspace-refresh"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <section aria-labelledby="organization-invitations-title">
                <div className="workspace-results-heading">
                  <h2 id="organization-invitations-title">
                    Organization invitations
                  </h2>
                  <span>{organizations.length} pending · Up to 100 shown</span>
                </div>

                {organizations.length === 0 ? (
                  <div className="workspace-state">
                    <p>No pending organization invitations.</p>
                  </div>
                ) : (
                  <div className="workspace-interview-list">
                    {organizations.map((invitation) => (
                      <article
                        key={invitation.id}
                        className="workspace-interview"
                      >
                        <div className="workspace-interview-heading">
                          <div>
                            <p className="workspace-interview-company">
                              Team invitation
                            </p>
                            <h2>{invitation.organization_name}</h2>
                          </div>

                          <span className="workspace-role">Interviewer</span>
                        </div>

                        <p>
                          Join this organization to conduct and review interviews.
                        </p>

                        <dl className="workspace-schedule">
                          <div>
                            <dt>Invitation expires</dt>
                            <dd>
                              <time dateTime={invitation.expires_at}>
                                {formatDate(invitation.expires_at)}
                              </time>
                            </dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          className="workspace-refresh"
                          disabled={accepting !== null}
                          onClick={() =>
                            void acceptInvitation(
                              'organizations',
                              invitation.id,
                            )
                          }
                        >
                          {accepting === `organizations:${invitation.id}`
                            ? 'Joining…'
                            : 'Accept and join'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section
                aria-labelledby="interview-invitations-title"
                style={{ marginTop: '36px' }}
              >
                <div className="workspace-results-heading">
                  <h2 id="interview-invitations-title">Interview invitations</h2>
                  <span>{interviews.length} pending · Up to 100 shown</span>
                </div>

                {interviews.length === 0 ? (
                  <div className="workspace-state">
                    <p>No pending interview invitations.</p>
                  </div>
                ) : (
                  <div className="workspace-interview-list">
                    {interviews.map((invitation) => (
                      <article
                        key={invitation.id}
                        className="workspace-interview"
                      >
                        <div className="workspace-interview-heading">
                          <div>
                            <p className="workspace-interview-company">
                              {invitation.organization_name}
                            </p>
                            <h2>{invitation.interview_title}</h2>
                          </div>

                          <span className="workspace-role">Candidate</span>
                        </div>

                        <dl className="workspace-schedule">
                          <div>
                            <dt>Starts</dt>
                            <dd>
                              <time dateTime={invitation.scheduled_start_at}>
                                {formatDate(invitation.scheduled_start_at)}
                              </time>
                            </dd>
                          </div>

                          <div>
                            <dt>Ends</dt>
                            <dd>
                              <time dateTime={invitation.scheduled_end_at}>
                                {formatDate(invitation.scheduled_end_at)}
                              </time>
                            </dd>
                          </div>

                          <div>
                            <dt>Invitation expires</dt>
                            <dd>
                              <time dateTime={invitation.expires_at}>
                                {formatDate(invitation.expires_at)}
                              </time>
                            </dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          className="workspace-refresh"
                          disabled={accepting !== null}
                          onClick={() =>
                            void acceptInvitation('interviews', invitation.id)
                          }
                        >
                          {accepting === `interviews:${invitation.id}`
                            ? 'Accepting…'
                            : 'Accept interview'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}