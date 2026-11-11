import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

type Organization = {
  id: string
  name: string
  role: 'ADMIN' | 'INTERVIEWER'
}

type Member = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'INTERVIEWER'
}

type Challenge = {
  id: string
  version_id: string
  version_number: number
  title: string
  language: string
}

export default function CreateInterviewPage() {
  const { organizationId } = useParams()
  const navigate = useNavigate()

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const [title, setTitle] = useState('')
  const [interviewerId, setInterviewerId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  const organizationPath = organizationId
    ? `/organizations/${encodeURIComponent(organizationId)}`
    : '/dashboard'

  useEffect(() => {
    let ignore = false

    async function loadForm() {
      setLoading(true)
      setLoadError('')
      setOrganization(null)
      setMembers([])
      setChallenges([])

      try {
        if (!organizationId) {
          throw new Error('Organization ID is missing.')
        }

        const options: RequestInit = {
          credentials: 'include',
          cache: 'no-store',
        }

        const organizationResponse = await fetch(
          '/api/organizations',
          options,
        )

        if (ignore) return

        if (organizationResponse.status === 401) {
          void navigate('/login', { replace: true })
          return
        }

        if (!organizationResponse.ok) {
          throw new Error('Unable to check organization access.')
        }

        const organizationData = await organizationResponse.json()

        if (ignore) return

        const organizations: Organization[] = organizationData.organizations
        const current = organizations.find(
          (item) => item.id === organizationId,
        )

        if (!current) {
          throw new Error('Organization unavailable or access denied.')
        }

        setOrganization(current)

        // The members endpoint is restricted to administrators.
        if (current.role !== 'ADMIN') return

        const baseUrl =
          `/api/organizations/${encodeURIComponent(organizationId)}`

        const [membersResponse, challengesResponse] = await Promise.all([
          fetch(`${baseUrl}/members`, options),
          fetch(`${baseUrl}/challenges`, options),
        ])

        if (ignore) return

        if (
          membersResponse.status === 401 ||
          challengesResponse.status === 401
        ) {
          void navigate('/login', { replace: true })
          return
        }

        if (!membersResponse.ok || !challengesResponse.ok) {
          throw new Error('Unable to load interviewers and challenges.')
        }

        const [membersData, challengesData] = await Promise.all([
          membersResponse.json(),
          challengesResponse.json(),
        ])

        if (ignore) return

        setMembers(membersData.members)
        setChallenges(challengesData.challenges)
      } catch (error) {
        if (!ignore) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to reach the server.',
          )
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void loadForm()

    return () => {
      ignore = true
    }
  }, [organizationId, attempt, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving || !organizationId || organization?.role !== 'ADMIN') return

    setError('')

    if (!title.trim()) {
      setError('Enter an interview title.')
      return
    }

    if (
      !members.some((member) => member.id === interviewerId) ||
      !challenges.some((challenge) => challenge.version_id === versionId)
    ) {
      setError('Choose an interviewer and a challenge.')
      return
    }

    // datetime-local values represent the user's local time.
    const start = new Date(startTime)
    const end = new Date(endTime)

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime())
    ) {
      setError('Choose valid start and end times.')
      return
    }

    if (start.getTime() <= Date.now()) {
      setError('The interview must start in the future.')
      return
    }

    if (end.getTime() <= start.getTime()) {
      setError('The end time must be after the start time.')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/interviews`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            interviewerId,
            versionId,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          }),
        },
      )

      if (response.status === 401) {
        setError('Your login expired. Sign in in another tab, then retry.')
        return
      }

      if (response.status === 403) {
        setError('Administrator access is required to schedule interviews.')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Unable to schedule the interview.')
        return
      }

      setCreated(true)
    } catch {
      setError(
        'Unable to confirm scheduling. Check the interview list before retrying.',
      )
    } finally {
      setSaving(false)
    }
  }

  const selectedChallenge = challenges.find(
    (challenge) => challenge.version_id === versionId,
  )

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className="interview-create-page">
      <header className="workspace-topbar">
        <p>
          <Link to={organizationPath}>Organization</Link>
          <span aria-hidden="true">/</span>
          <strong>Schedule interview</strong>
        </p>

        <Link to={organizationPath}>Back to organization</Link>
      </header>

      <main className="workspace-main">
        {loading ? (
          <div className="workspace-state" role="status">
            <h2>Preparing the schedule.</h2>
            <p>Loading your interviewers and challenges.</p>
          </div>
        ) : loadError ? (
          <div className="workspace-state" role="alert">
            <h2>Unable to open the form.</h2>
            <p>{loadError}</p>

            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : organization?.role !== 'ADMIN' ? (
          <div className="workspace-state">
            <h2>Administrator access required.</h2>
            <p>Only organization administrators can schedule interviews.</p>
          </div>
        ) : created ? (
          <div className="workspace-state">
            <p className="workspace-eyebrow" role="status">
              Interview scheduled
            </p>

            <h2>Your interview is on the calendar.</h2>
            <p>
              The interview has been saved. A candidate still needs to be
              invited before the session can start.
            </p>

            <p>
              <Link to={organizationPath}>
                Return to organization →
              </Link>
            </p>
          </div>
        ) : challenges.length === 0 ? (
          <div className="workspace-state">
            <h2>Create a challenge first.</h2>
            <p>An interview needs a challenge version to assess.</p>

            <p>
              <Link to={`${organizationPath}/challenges/new`}>
                Create a challenge →
              </Link>
            </p>
          </div>
        ) : (
          <>
            <section className="workspace-heading">
              <div>
                <p className="workspace-eyebrow">{organization.name}</p>
                <h1>Schedule an interview<span>.</span></h1>

                <p className="workspace-description">
                  Choose the interviewer, challenge and time.
                  You’ll invite the candidate after scheduling.
                </p>
              </div>
            </section>

            <form className="interview-form" onSubmit={handleSubmit}>
              <fieldset disabled={saving}>
                <legend>Interview details</legend>

                <label htmlFor="interview-title">Interview title</label>
                <input
                  id="interview-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="For example, JavaScript technical interview"
                  maxLength={200}
                  required
                />

                <label htmlFor="interviewer">Interviewer</label>
                <select
                  id="interviewer"
                  value={interviewerId}
                  onChange={(event) => setInterviewerId(event.target.value)}
                  required
                >
                  <option value="">Choose an interviewer</option>

                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} — {member.email}
                    </option>
                  ))}
                </select>

                <label htmlFor="interview-challenge">Challenge</label>
                <select
                  id="interview-challenge"
                  value={versionId}
                  onChange={(event) => setVersionId(event.target.value)}
                  aria-describedby="challenge-version-help"
                  required
                >
                  <option value="">Choose a challenge</option>

                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.version_id}>
                      {challenge.title} — Version {challenge.version_number}
                    </option>
                  ))}
                </select>

                <p id="challenge-version-help" className="interview-form-help">
                  This list shows the latest versions of up to 50 challenges.
                  The selected version stays assigned to this interview.
                </p>

                {selectedChallenge && (
                  <Link
                    to={
                      `${organizationPath}/challenge-versions/` +
                      selectedChallenge.version_id
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Preview selected challenge ↗
                  </Link>
                )}
              </fieldset>

              <fieldset disabled={saving}>
                <legend>Date and time</legend>

                <p className="interview-form-help">
                  Enter times in your device’s timezone: {timezone}.
                </p>

                <div className="interview-time-grid">
                  <div>
                    <label htmlFor="interview-start">Starts</label>
                    <input
                      id="interview-start"
                      type="datetime-local"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="interview-end">Ends</label>
                    <input
                      id="interview-end"
                      type="datetime-local"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      required
                    />
                  </div>
                </div>
              </fieldset>

              {error && (
                <p className="workspace-error" role="alert">
                  {error}
                </p>
              )}

              <div className="interview-form-footer">
                <p>The candidate invitation is a separate step.</p>

                <button type="submit" disabled={saving}>
                  {saving ? 'Scheduling…' : 'Schedule interview'}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  )
}