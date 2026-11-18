import { apiFetch } from '../../lib/apiFetch'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import InterviewActions from './InterviewActions'
import InviteCandidate from './InviteCandidate'
import InterviewSubmissions from './InterviewSubmissions'
import InterviewEvaluation from './InterviewEvaluation'
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
  const [view, setView] = useState<
  'overview' | 'submissions' | 'evaluation'
>('overview')
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

        const response = await apiFetch(
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
    <div className="review-room">
      <header className="review-topbar">
        <Link to="/dashboard" className="review-brand">
          <span aria-hidden="true">IP</span>
          <strong>Interview Platform</strong>
        </Link>

        <span className="review-topbar-label">Interviewer workspace</span>

        <Link to={organizationPath}>← Organization</Link>
      </header>

      <main className="review-main">
        {loading ? (
          <div className="review-state" role="status">
            <h1>Loading interview</h1>
            <p>Fetching the session details.</p>
          </div>
        ) : error ? (
          <div className="review-state" role="alert">
            <h1>Interview unavailable</h1>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : interview && organizationId ? (
          <>
            <section className="review-summary">
              <div>
                <p className="review-eyebrow">Technical interview</p>
                <h1>{interview.title}</h1>
                <p className="review-summary-meta">
                  {interview.interviewer_name}
                  {' · '}
                  {interview.challenge_title}
                  {' · Version '}
                  {interview.version_number}
                </p>
              </div>

              <span
                className="review-status"
                data-status={interview.status}
              >
                {interview.status.replaceAll('_', ' ')}
              </span>
            </section>

            <nav className="review-navigation" aria-label="Interview sections">
              <button
                type="button"
                aria-pressed={view === 'overview'}
                onClick={() => setView('overview')}
              >
                Overview
              </button>

              <button
                type="button"
                aria-pressed={view === 'submissions'}
                onClick={() => setView('submissions')}
              >
                Submissions
              </button>
              <button
              type="button"
              aria-pressed={view === 'evaluation'}
              onClick={() => setView('evaluation')}
              >
                Evaluation
              </button>
            </nav>

            <div hidden={view !== 'overview'}>
              <div className="review-overview-grid">
                <section className="review-card">
                  <p className="review-eyebrow">Schedule</p>
                  <h2>Session information</h2>

                  <dl className="review-facts">
                    <div>
                      <dt>Interviewer</dt>
                      <dd>{interview.interviewer_name}</dd>
                    </div>

                    <div>
                      <dt>Starts</dt>
                      <dd>
                        <time dateTime={interview.scheduled_start_at}>
                          {formatDate(interview.scheduled_start_at)}
                        </time>
                      </dd>
                    </div>

                    <div>
                      <dt>Ends</dt>
                      <dd>
                        <time dateTime={interview.scheduled_end_at}>
                          {formatDate(interview.scheduled_end_at)}
                        </time>
                      </dd>
                    </div>
                  </dl>

                  <p className="review-muted">
                    Times are displayed in your local timezone.
                  </p>
                </section>

                <section className="review-card">
                  <p className="review-eyebrow">
                    {interview.language} · Version {interview.version_number}
                  </p>
                  <h2>{interview.challenge_title}</h2>

                  <p className="review-problem-description">
                    {interview.description}
                  </p>

                  <Link
                    className="review-text-link"
                    to={
                      `${organizationPath}/challenge-versions/` +
                      encodeURIComponent(interview.challenge_version_id)
                    }
                  >
                    View challenge and examples ↗
                  </Link>
                </section>
              </div>

              <div className="review-controls">
                <InterviewActions
                  key={interview.id}
                  organizationId={organizationId}
                  interviewId={interview.id}
                  status={interview.status}
                  onUpdated={() => setAttempt((value) => value + 1)}
                />
              </div>

              {interview.status === 'SCHEDULED' && (
                <div className="review-invite interview-invitation">
                  <InviteCandidate
                    key={interview.id}
                    organizationId={organizationId}
                    interviewId={interview.id}
                  />
                </div>
              )}
            </div>

            {view === 'submissions' && (
              <InterviewSubmissions
                key={`${organizationId}:${interview.id}`}
                organizationId={organizationId}
                interviewId={interview.id}
              />
            )}
            <div hidden={view !== 'evaluation'}>
  <InterviewEvaluation
    key={`${organizationId}:${interview.id}`}
    organizationId={organizationId}
    interviewId={interview.id}
    status={interview.status}
  />
</div>
          </>
        ) : null}
      </main>
    </div>
  )
}