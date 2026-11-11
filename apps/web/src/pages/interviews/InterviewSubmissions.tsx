import { lazy, Suspense, useEffect, useState } from 'react'
import ExecutionResults from '../candidate/ExecutionResults'

const SubmissionCode = lazy(() => import('./SubmissionCode'))

type Submission = {
  id: string
  candidate_id: string
  source_code: string
  submitted_at: string
}

type Props = {
  organizationId: string
  interviewId: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function InterviewSubmissions({
  organizationId,
  interviewId,
}: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSubmissions() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}` +
            `/interviews/${encodeURIComponent(interviewId)}/submissions`,
          {
            credentials: 'include',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (response.status === 401) {
          throw new Error('Your session expired. Please sign in again.')
        }

        if (response.status === 403 || response.status === 404) {
          throw new Error(
            'These submissions are unavailable or you no longer have access.',
          )
        }

        if (!response.ok) {
          throw new Error('Unable to load submissions. Please try again.')
        }

        const data = await response.json()

        if (!Array.isArray(data.submissions)) {
          throw new Error('The server returned invalid submission data.')
        }

        if (controller.signal.aborted) return

        const items: Submission[] = data.submissions
        setSubmissions(items)

        setSelectedId((current) =>
          items.some((item) => item.id === current)
            ? current
            : (items[0]?.id ?? ''),
        )
      } catch (error) {
        if (controller.signal.aborted) return

        setSubmissions([])
        setSelectedId('')
        setError(
          error instanceof Error
            ? error.message
            : 'Unable to reach the server.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadSubmissions()

    return () => controller.abort()
  }, [organizationId, interviewId, attempt])

  const selected = submissions.find((item) => item.id === selectedId)

  return (
    <section aria-labelledby="review-submissions-title">
      <header className="review-submissions-toolbar">
        <div>
          <h2 id="review-submissions-title">Candidate submissions</h2>
          <p className="review-muted">
            Latest 50 submissions at most. Select one to inspect its code
            and results.
          </p>
        </div>

        <button
          type="button"
          className="review-secondary"
          disabled={loading}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </header>

      {error ? (
        <p className="review-error" role="alert">{error}</p>
      ) : loading && submissions.length === 0 ? (
        <p className="review-muted" role="status">Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <div className="review-empty">
          <h3>No submissions yet</h3>
          <p>Refresh after the candidate submits a solution.</p>
        </div>
      ) : (
        <div className="review-submissions-layout">
          <aside className="review-submission-list" aria-label="Submissions">
            <div className="review-list-heading">
              <strong>History</strong>
              <span>{submissions.length}</span>
            </div>

            {submissions.map((submission, index) => (
              <button
                key={submission.id}
                type="button"
                className="review-submission-item"
                aria-pressed={selectedId === submission.id}
                onClick={() => setSelectedId(submission.id)}
              >
                <strong>
                  {index === 0 ? 'Latest submission' : 'Earlier submission'}
                </strong>
                <time dateTime={submission.submitted_at}>
                  {formatDate(submission.submitted_at)}
                </time>
                <span>{submission.id.slice(0, 8)}</span>
              </button>
            ))}
          </aside>

          {selected && (
            <div className="review-submission-content">
              <section className="review-code-panel">
                <header className="review-code-heading">
                  <strong>Submitted solution</strong>
                  <span>JavaScript · Read only</span>
                </header>

                <div className="review-code-viewer">
                  <Suspense
                    fallback={
                      <p className="review-muted">Loading code viewer…</p>
                    }
                  >
                    <SubmissionCode
                      key={selected.id}
                      sourceCode={selected.source_code}
                    />
                  </Suspense>
                </div>
              </section>

              <div className="review-execution">
                <ExecutionResults
                  key={`${organizationId}:${interviewId}:${selected.id}`}
                  audience="staff"
                  executionUrl={
                    `/api/organizations/${encodeURIComponent(organizationId)}` +
                    `/interviews/${encodeURIComponent(interviewId)}` +
                    `/submissions/${encodeURIComponent(selected.id)}/execution`
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}