import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import OrganizationMembers from './OrganizationMembers'

type Organization = {
  id: string
  name: string
  slug: string
  role: 'ADMIN' | 'INTERVIEWER'
}

type Challenge = {
  id: string
  version_id: string
  version_number: number
  title: string
  language: string
  created_at: string
}

type Interview = {
  id: string
  title: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  scheduled_start_at: string
  scheduled_end_at: string
  interviewer_name: string
  challenge_title: string
  version_number: number
}

type Section = 'interviews' | 'challenges' | 'members'

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function OrganizationPage() {
  const { organizationId } = useParams()
  const navigate = useNavigate()

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])

  const [section, setSection] = useState<Section>('interviews')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadOrganization() {
      setLoading(true)
      setError('')
      setOrganization(null)
      setInterviews([])
      setChallenges([])

      if (!organizationId) {
        setError('Organization ID is missing.')
        setLoading(false)
        return
      }

      const baseUrl =
        `/api/organizations/${encodeURIComponent(organizationId)}`

      const options: RequestInit = {
        credentials: 'include',
        cache: 'no-store',
      }

      try {
        const [organizationsResponse, interviewsResponse, challengesResponse] =
          await Promise.all([
            fetch('/api/organizations', options),
            fetch(`${baseUrl}/interviews`, options),
            fetch(`${baseUrl}/challenges`, options),
          ])

        if (ignore) return

        const responses = [
          organizationsResponse,
          interviewsResponse,
          challengesResponse,
        ]

        if (responses.some((response) => response.status === 401)) {
          void navigate('/login', { replace: true })
          return
        }

        if (
          responses.some(
            (response) =>
              response.status === 403 || response.status === 404,
          )
        ) {
          throw new Error(
            'This organization is unavailable or you no longer have access.',
          )
        }

        if (responses.some((response) => !response.ok)) {
          throw new Error('Unable to load the organization. Please try again.')
        }

        const [organizationsData, interviewsData, challengesData] =
          await Promise.all([
            organizationsResponse.json(),
            interviewsResponse.json(),
            challengesResponse.json(),
          ])

        if (ignore) return

        const memberships: Organization[] = organizationsData.organizations

        const currentOrganization = memberships.find(
          (item) => item.id === organizationId,
        )

        if (!currentOrganization) {
          throw new Error(
            'This organization is unavailable or you no longer have access.',
          )
        }

        setOrganization(currentOrganization)
        setInterviews(interviewsData.interviews)
        setChallenges(challengesData.challenges)
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

    void loadOrganization()

    return () => {
      ignore = true
    }
  }, [organizationId, attempt, navigate])

  function refresh() {
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  const showingInterviews = section === 'interviews'

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
          <p className="workspace-nav-label">Organization</p>

          <nav className="workspace-nav" aria-label="Organization sections">
  <button
    type="button"
    className={section === 'interviews' ? 'is-active' : ''}
    aria-pressed={section === 'interviews'}
    onClick={() => setSection('interviews')}
  >
    <span>Interviews</span>
    {!loading && !error && <span>{interviews.length}</span>}
  </button>

  <button
    type="button"
    className={section === 'challenges' ? 'is-active' : ''}
    aria-pressed={section === 'challenges'}
    onClick={() => setSection('challenges')}
  >
    <span>Challenges</span>
    {!loading && !error && <span>{challenges.length}</span>}
  </button>

  {organization?.role === 'ADMIN' && (
    <button
      type="button"
      className={section === 'members' ? 'is-active' : ''}
      aria-pressed={section === 'members'}
      onClick={() => setSection('members')}
    >
      <span>Members</span>
    </button>
  )}
</nav>

          <div className="workspace-sidebar-note">
            <span className="workspace-note-line" aria-hidden="true" />
            <p>Good questions. Thoughtful conversations.</p>
          </div>
        </div>

        <div className="workspace-sidebar-footer">
          <Link to="/dashboard">← Back to dashboard</Link>
          <Link to="/">Visit website ↗</Link>
        </div>
      </aside>

      <div className="workspace-content">
        <header className="workspace-topbar">
          <p>
            <Link to="/dashboard">Workspace</Link>
            <span aria-hidden="true">/</span>
            <strong>{organization?.name ?? 'Organization'}</strong>
          </p>

          {organization && (
            <span className="workspace-role">
              {organization.role === 'ADMIN'
                ? 'Administrator'
                : 'Interviewer'}
            </span>
          )}
        </header>

        <main className="workspace-main">
          {loading ? (
            <div className="workspace-state" role="status">
              <p className="workspace-eyebrow">One moment</p>
              <h2>Opening your organization.</h2>
              <p>Loading interviews and challenge versions.</p>
            </div>
          ) : error ? (
            <div className="workspace-state" role="alert">
              <h2>Unable to open this workspace.</h2>
              <p>{error}</p>

              <button type="button" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : organization && section === 'members' ? (
  organization.role === 'ADMIN' ? (
    <>
      <section className="workspace-heading">
        <div>
          <p className="workspace-eyebrow">{organization.name}</p>

          <h1>
            Members<span>.</span>
          </h1>

          <p className="workspace-description">
            Manage your organization’s interview team.
          </p>
        </div>
      </section>

      <OrganizationMembers
        key={organization.id}
        organizationId={organization.id}
      />
    </>
  ) : (
    <div className="workspace-state" role="alert">
      <h2>Administrator access required.</h2>
      <p>Only organization administrators can manage members.</p>

      <button
        type="button"
        onClick={() => setSection('interviews')}
      >
        Back to interviews
      </button>
    </div>
  )
) : organization ? (
            <>
              <section className="workspace-heading">
                <div>
                  <p className="workspace-eyebrow">{organization.name}</p>

                  <h1>
                    {showingInterviews ? 'Interviews' : 'Challenges'}
                    <span>.</span>
                  </h1>

                  <p className="workspace-description">
                    {showingInterviews
                      ? organization.role === 'ADMIN'
                        ? 'Review your organization’s interview schedule.'
                        : 'Review interviews assigned to you.'
                      : 'Browse the latest version of each interview challenge.'}
                  </p>
                </div>

                <div
  style={{
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  }}
>
  {organization.role === 'ADMIN' && (
    showingInterviews ? (
      <Link
        to={`/organizations/${organization.id}/interviews/new`}
        className="workspace-refresh"
      >
        + Schedule interview
      </Link>
    ) : (
      <Link
        to={`/organizations/${organization.id}/challenges/new`}
        className="workspace-refresh"
      >
        + Create challenge
      </Link>
    )
  )}

  <button
    type="button"
    className="workspace-refresh"
    onClick={refresh}
  >
    Refresh
  </button>
</div>
              </section>

              <div className="workspace-results-heading">
                <p role="status">
                  {showingInterviews
                    ? `${interviews.length} interviews shown`
                    : `${challenges.length} challenges shown`}
                </p>

                <span>
                  {showingInterviews
                    ? 'Up to 50 interviews · Local timezone'
                    : 'Up to 50 challenges · Latest versions'}
                </span>
              </div>

              {showingInterviews ? (
                interviews.length === 0 ? (
                  <div className="workspace-state">
                    <h2>No interviews to show.</h2>
                    <p>
                      {organization.role === 'ADMIN'
                        ? 'Scheduled interviews will appear here.'
                        : 'Interviews assigned to you will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="workspace-interview-list">
                    {interviews.map((interview) => (
                      <article
                        className="workspace-interview"
                        key={interview.id}
                      >
                        <div className="workspace-interview-heading">
                          <div>
                            <p className="workspace-interview-company">
                              {interview.challenge_title}
                              {' · Version '}
                              {interview.version_number}
                            </p>

                            <h2>{interview.title}</h2>
                          </div>

                          <span
                            className="workspace-status"
                            data-status={interview.status}
                          >
                            {interview.status.replaceAll('_', ' ')}
                          </span>
                        </div>

                        <dl className="workspace-schedule">
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

                        <Link
                          to={`/organizations/${organizationId}/interviews/${interview.id}`}
                          className="workspace-card-footer"
                          aria-label={`Open interview: ${interview.title}`}
                        >
                          <span>Open interview</span>
                          <span aria-hidden="true">↗</span>
                        </Link>
                      </article>
                    ))}
                  </div>
                )
              ) : challenges.length === 0 ? (
                <div className="workspace-state">
                  <h2>No challenges yet.</h2>
                  <p>
                    Challenges created by organization admins will appear here.
                  </p>
                </div>
              ) : (
                <div className="workspace-organization-grid">
                  {challenges.map((challenge) => (
  <Link
    to={`/organizations/${organizationId}/challenge-versions/${challenge.version_id}`}
    className="workspace-organization"
    key={challenge.id}
    aria-label={`View ${challenge.title}, version ${challenge.version_number}`}
  >
    <div className="workspace-card-top">
      <span className="workspace-role">
        {challenge.language === 'javascript'
          ? 'JavaScript'
          : challenge.language}
      </span>

      <span className="workspace-role">
        Version {challenge.version_number}
      </span>
    </div>

    <h2>{challenge.title}</h2>

    <div className="workspace-card-footer">
      <span>
        Created{' '}
        <time dateTime={challenge.created_at}>
          {formatDate(challenge.created_at)}
        </time>
      </span>

      <strong>View challenge ↗</strong>
    </div>
  </Link>
))}
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}