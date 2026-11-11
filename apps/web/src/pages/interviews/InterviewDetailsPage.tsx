import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import InterviewActions from './InterviewActions'
import InviteCandidate from './InviteCandidate'

import './InterviewDetailsPage.css'

type Interview = {
  id: string
  title: string
  status: string
  scheduled_start_at: string
  scheduled_end_at: string
  interviewer_id: string
  interviewer_name: string
  challenge_version_id: string
  version_number: number
  challenge_title: string
  description: string
  language: string
  starter_code: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function InterviewDetailsPage() {
  const { organizationId, interviewId } = useParams()
  const navigate = useNavigate()

  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const organizationPath = organizationId
    ? `/organizations/${encodeURIComponent(organizationId)}`
    : '/dashboard'

  useEffect(() => {
    let ignore = false

    async function loadInterview() {
      setLoading(true)
      setError('')
      setInterview(null)

      try {
        if (!organizationId || !interviewId) {
          throw new Error('Organization or interview ID is missing.')
        }

        const response = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}` +
            `/interviews/${encodeURIComponent(interviewId)}`,
          {
            credentials: 'include',
            cache: 'no-store',
          },
        )

        if (ignore) return

        if (response.status === 401) {
          void navigate('/login', { replace: true })
          return
        }

        if (response.status === 403 || response.status === 404) {
          throw new Error(
            'This interview is unavailable or you do not have access.',
          )
        }

        if (!response.ok) {
          throw new Error('Unable to load the interview. Please try again.')
        }

        const data = await response.json()

        if (!data.interview) {
          throw new Error('The server did not return interview details.')
        }

        if (!ignore) setInterview(data.interview)
      } catch (error) {
        if (!ignore) {
          setError(
            error instanceof Error
              ? error.message
              : 'Unable to reach the server.',
          )
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void loadInterview()

    return () => {
      ignore = true
    }
  }, [organizationId, interviewId, attempt, navigate])

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
          <p className="workspace-nav-label">Interview details</p>

          <div className="workspace-sidebar-note">
            <span className="workspace-note-line" aria-hidden="true" />
            <p>The challenge. The conversation. The evidence.</p>
          </div>
        </div>

        <div className="workspace-sidebar-footer">
          <Link to={organizationPath}>← Back to organization</Link>
          <Link to="/dashboard">Go to dashboard</Link>
        </div>
      </aside>

      <div className="workspace-content">
        <header className="workspace-topbar">
          <p>
            <Link to={organizationPath}>Organization</Link>
            <span aria-hidden="true">/</span>
            <strong>Interview details</strong>
          </p>

          {interview && (
            <span className="workspace-role">
              {interview.status.replaceAll('_', ' ')}
            </span>
          )}
        </header>

        <main className="workspace-main">
          {loading ? (
            <div className="workspace-state" role="status">
              <h2>Loading interview.</h2>
              <p>Fetching the schedule and assigned challenge.</p>
            </div>
          ) : error ? (
            <div className="workspace-state" role="alert">
              <h2>Unable to open this interview.</h2>
              <p>{error}</p>

              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : interview ? (
            <>
              <section className="workspace-heading">
                <div>
                  <p className="workspace-eyebrow">Technical interview</p>
                  <h1>{interview.title}</h1>
                  <p className="workspace-description">
                    Review the schedule, interviewer and assigned challenge.
                  </p>
                </div>
              </section>

              <div className="challenge-layout">
                <section className="challenge-panel">
                  <p className="workspace-eyebrow">The session</p>
                  <h2>Interview information</h2>

                  <p className="challenge-value-label">Interviewer</p>
                  <p>{interview.interviewer_name}</p>

                  <p className="challenge-value-label">Starts</p>
                  <p>
                    <time dateTime={interview.scheduled_start_at}>
                      {formatDate(interview.scheduled_start_at)}
                    </time>
                  </p>

                  <p className="challenge-value-label">Ends</p>
                  <p>
                    <time dateTime={interview.scheduled_end_at}>
                      {formatDate(interview.scheduled_end_at)}
                    </time>
                  </p>

                  <p className="workspace-description">
                    Times are displayed in your local timezone.
                  </p>
                </section>

                <section className="challenge-panel">
                  <p className="workspace-eyebrow">
                    {interview.language} · Version {interview.version_number}
                  </p>

                  <h2>{interview.challenge_title}</h2>

                  <p className="challenge-description">
                    {interview.description}
                  </p>

                  <Link
                    to={
                      `${organizationPath}/challenge-versions/` +
                      encodeURIComponent(interview.challenge_version_id)
                    }
                  >
                    View challenge and examples →
                  </Link>
                </section>
                            </div>

                            {organizationId && (
                <>
                  {interview.status === 'SCHEDULED' && (
                    <div className="interview-actions interview-invitation">
                      <InviteCandidate
                        key={interview.id}
                        organizationId={organizationId}
                        interviewId={interview.id}
                      />
                    </div>
                  )}

                  <div className="interview-actions">
                    <InterviewActions
                      key={interview.id}
                      organizationId={organizationId}
                      interviewId={interview.id}
                      status={interview.status}
                      onUpdated={() => setAttempt((value) => value + 1)}
                    />
                  </div>
                </>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}