import { apiFetch } from '../../lib/apiFetch'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import VerifyEmailPanel from './VerifyEmailPanel'

type Organization = {
  id: string
  name: string
  slug: string
  role: 'ADMIN' | 'INTERVIEWER'
}

type InterviewStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

type Interview = {
  id: string
  title: string
  status: InterviewStatus
  scheduled_start_at: string
  scheduled_end_at: string
  organization_name: string
}

type WorkspaceView = 'organizations' | 'interviews'

const statusLabels: Record<InterviewStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const [view, setView] = useState<WorkspaceView>('organizations')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadDashboard() {
      try {
        const [organizationResponse, interviewResponse] = await Promise.all([
          apiFetch('/api/organizations', {
            credentials: 'include',
            cache: 'no-store',
          }),
          apiFetch('/api/candidate/interviews', {
            credentials: 'include',
            cache: 'no-store',
          }),
        ])

        if (ignore) return

        if (
          organizationResponse.status === 401 ||
          interviewResponse.status === 401
        ) {
          void navigate('/login', { replace: true })
          return
        }

        if (!organizationResponse.ok || !interviewResponse.ok) {
          throw new Error('Unable to load your workspace. Please try again.')
        }

        const [organizationData, interviewData] = await Promise.all([
          organizationResponse.json(),
          interviewResponse.json(),
        ])

        if (ignore) return

        setOrganizations(organizationData.organizations)
        setInterviews(interviewData.interviews)
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

    void loadDashboard()

    return () => {
      ignore = true
    }
  }, [attempt, navigate])

  function changeView(nextView: WorkspaceView) {
    setView(nextView)
    setSearch('')
    setStatusFilter('ALL')
  }

  function refresh() {
    setError('')
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)
    setLogoutError('')

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to sign out. Please try again.')
      }

      void navigate('/login', { replace: true })
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : 'Unable to reach the server.',
      )
    } finally {
      setLoggingOut(false)
    }
  }

  const query = search.trim().toLowerCase()

  const visibleOrganizations = organizations.filter((organization) =>
    `${organization.name} ${organization.slug}`.toLowerCase().includes(query),
  )

  const visibleInterviews = interviews.filter((interview) => {
    const matchesSearch =
      `${interview.title} ${interview.organization_name}`
        .toLowerCase()
        .includes(query)

    const matchesStatus =
      statusFilter === 'ALL' || interview.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const showingOrganizations = view === 'organizations'
  const total = showingOrganizations
    ? organizations.length
    : interviews.length

  const visibleCount = showingOrganizations
    ? visibleOrganizations.length
    : visibleInterviews.length

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
          <p className="workspace-nav-label">Workspace</p>

          <nav className="workspace-nav" aria-label="Workspace sections">
            <button
              type="button"
              className={showingOrganizations ? 'is-active' : ''}
              aria-pressed={showingOrganizations}
              onClick={() => changeView('organizations')}
            >
              <span>Organizations</span>
              {!loading && !error && <span>{organizations.length}</span>}
            </button>

            <button
              type="button"
              className={!showingOrganizations ? 'is-active' : ''}
              aria-pressed={!showingOrganizations}
              onClick={() => changeView('interviews')}
            >
              <span>My interviews</span>
              {!loading && !error && <span>{interviews.length}</span>}
            </button>
          </nav>

          <div className="workspace-sidebar-note">
            <span className="workspace-note-line" aria-hidden="true" />
            <p>Every interview starts with a better conversation.</p>
          </div>
        </div>

        <div className="workspace-sidebar-footer">
          <Link to="/organizations/new">
            + Create organization
          </Link>
          <Link to="/invitations/accept">Invitations</Link>
          <Link to="/">Back to website ↗</Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="workspace-content">
        <header className="workspace-topbar">
          <p>
            Workspace <span aria-hidden="true">/</span>
            <strong>
              {showingOrganizations ? 'Organizations' : 'My interviews'}
            </strong>
          </p>

          <span className="workspace-topbar-label">
            Technical interviews
          </span>
        </header>

        <main className="workspace-main">
          <section className="workspace-heading">
            <div>
              <p className="workspace-eyebrow">
                {showingOrganizations ? 'Your teams. Your workspace.' : 'Your next conversation.'}
              </p>

              <h1>
                {showingOrganizations ? 'Organizations' : 'My interviews'}
                <span>.</span>
              </h1>

              <p className="workspace-description">
                {showingOrganizations
                  ? 'The teams you belong to and your role in each.'
                  : 'Keep track of interviews you have joined as a candidate.'}
              </p>
            </div>

            <button
              type="button"
              className="workspace-refresh"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </section>

          {logoutError && (
            <p className="workspace-error" role="alert">
              {logoutError}
            </p>
          )}

          {loading ? (
            <div className="workspace-state" role="status">
              <p className="workspace-eyebrow">One moment</p>
              <h2>Preparing your workspace.</h2>
              <p>Loading your organizations and interview schedule.</p>
            </div>
          ) : error ? (
            <div className="workspace-state" role="alert">
              <h2>We couldn’t load your workspace.</h2>
              <p>{error}</p>
              <button type="button" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : (
            <>
              <section
                className="workspace-toolbar"
                aria-label="Search and filters"
              >
                <VerifyEmailPanel />
                <div className="workspace-search">
                  <label htmlFor="workspace-search">
                    {showingOrganizations
                      ? 'Search organizations'
                      : 'Search interviews'}
                  </label>

                  <input
                    id="workspace-search"
                    type="search"
                    placeholder={
                      showingOrganizations
                        ? 'Search by name or slug…'
                        : 'Search by interview or organization…'
                    }
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                {!showingOrganizations && (
                  <div className="workspace-filter">
                    <label htmlFor="interview-status">Status</label>

                    <select
                      id="interview-status"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="ALL">All statuses</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                )}
              </section>

              <div className="workspace-results-heading">
                <p role="status">
                  Showing {visibleCount} of {total}
                </p>

                <span>
                  {showingOrganizations
                    ? 'Organization memberships'
                    : 'Up to 50 recent interviews · Local timezone'}
                </span>
              </div>

              {total === 0 ? (
                <div className="workspace-state">
                  <h2>
                    {showingOrganizations
                      ? 'Your team belongs here.'
                      : 'Your next interview starts here.'}
                  </h2>

                  <p>
                    {showingOrganizations
                      ? 'Organizations you create or are added to will appear here. You can attend interviews without joining an organization.'
                      : 'Accept an interview invitation to see its schedule and status here.'}
                  </p>

                  {showingOrganizations && (
                    <button
                      type="button"
                      onClick={() => changeView('interviews')}
                    >
                      View my interviews
                    </button>
                  )}
                </div>
              ) : visibleCount === 0 ? (
                <div className="workspace-state">
                  <h2>No matches found.</h2>
                  <p>Try a different search or reset your filters.</p>

                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('ALL')
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              ) : showingOrganizations ? (
                <div className="workspace-organization-grid">
                  {visibleOrganizations.map((organization) => (
  <Link
    to={`/organizations/${organization.id}`}
    className="workspace-organization"
    key={organization.id}
    aria-label={`Open ${organization.name} workspace`}
  >
    <div className="workspace-card-top">
      <span className="workspace-avatar" aria-hidden="true">
        {organization.name.slice(0, 1).toUpperCase()}
      </span>

      <span className="workspace-role">
        {organization.role === 'ADMIN'
          ? 'Administrator'
          : 'Interviewer'}
      </span>
    </div>

    <h2>{organization.name}</h2>

    <p className="workspace-slug">
      /{organization.slug}
    </p>

    <div className="workspace-card-footer">
      <span>
        {organization.role === 'ADMIN'
          ? 'Organization administration'
          : 'Assigned interviews'}
      </span>

      <strong>Open workspace ↗</strong>
    </div>
  </Link>
))}
                </div>
              ) : (
                <div className="workspace-interview-list">
                  {visibleInterviews.map((interview) => (
                    <article
                      className="workspace-interview"
                      key={interview.id}
                    >
                      <div className="workspace-interview-heading">
                        <div>
                          <p className="workspace-interview-company">
                            {interview.organization_name}
                          </p>
                          <h2>{interview.title}</h2>
                        </div>

                        <span
                          className="workspace-status"
                          data-status={interview.status}
                        >
                          {statusLabels[interview.status]}
                        </span>
                      </div>

                      <dl className="workspace-schedule">
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

                      {interview.status === 'IN_PROGRESS' && (
                        <Link
                          to={`/candidate/interviews/${interview.id}`}
                          className="workspace-card-footer"
                          aria-label={`Open workspace for ${interview.title}`}
                        >
                          <span>Open workspace</span>
                          <span aria-hidden="true">↗</span>
                        </Link>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}