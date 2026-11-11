import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import ExecutionResults from './ExecutionResults'
import './CandidateInterviewPage.css'

const CodeEditor = lazy(() => import('./CodeEditor'))

type Challenge = {
  version_id: string
  title: string
  description: string
  language: string
  starter_code: string
}

type Example = {
  position: number
  input: unknown[]
  expected_output: unknown
}

type MobileView = 'problem' | 'code' | 'results'

export default function CandidateInterviewPage() {
  const { interviewId } = useParams()
  const navigate = useNavigate()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [examples, setExamples] = useState<Example[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [executionUrl, setExecutionUrl] = useState('')
  const [mobileView, setMobileView] = useState<MobileView>('problem')

  useEffect(() => {
    let ignore = false

    async function loadChallenge() {
      setLoading(true)
      setError('')
      setChallenge(null)
      setExamples([])
      setExecutionUrl('')
      setMobileView('problem')

      try {
        if (!interviewId) {
          throw new Error('Interview ID is missing.')
        }

        const response = await fetch(
          `/api/candidate/interviews/${encodeURIComponent(interviewId)}/challenge`,
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
            'This challenge is unavailable. You must be the assigned ' +
              'candidate, and the interview must be in progress within ' +
              'its scheduled time.',
          )
        }

        if (!response.ok) {
          throw new Error('Unable to load the challenge. Please try again.')
        }

        const data = await response.json()

        if (!data.challenge || !Array.isArray(data.examples)) {
          throw new Error('The server returned incomplete challenge details.')
        }

        if (!ignore) {
          setChallenge(data.challenge)
          setExamples(data.examples)
        }
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

    void loadChallenge()

    return () => {
      ignore = true
    }
  }, [interviewId, attempt, navigate])

  function handleSubmitted(url: string) {
    setExecutionUrl(url)
    setMobileView('results')
  }

  return (
    <div className="coding-room" data-mobile-view={mobileView}>
      <header className="coding-topbar">
        <Link to="/dashboard" className="coding-brand">
          <span aria-hidden="true">IP</span>
          <strong>Interview Platform</strong>
        </Link>

        <div className="coding-session">
          <span>Candidate workspace</span>
          <strong>{challenge?.title ?? 'Interview'}</strong>
        </div>

        <Link to="/dashboard" className="coding-back">
          ← Dashboard
        </Link>
      </header>

      {loading ? (
        <main className="coding-state" role="status">
          <h1>Preparing your workspace</h1>
          <p>Checking access and loading the challenge.</p>
        </main>
      ) : error ? (
        <main className="coding-state" role="alert">
          <h1>Challenge unavailable</h1>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </main>
      ) : challenge && interviewId ? (
        <>
          <nav className="coding-mobile-nav" aria-label="Workspace panels">
            {(['problem', 'code', 'results'] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={mobileView === view}
                onClick={() => setMobileView(view)}
              >
                {view}
              </button>
            ))}
          </nav>

          <main className="coding-layout">
            <section className="coding-problem" aria-labelledby="problem-title">
              <div className="coding-panel-bar">
                <strong>Problem</strong>
                <span>{challenge.language}</span>
              </div>

              <div className="coding-problem-content">
                <p className="coding-eyebrow">Technical challenge</p>
                <h1 id="problem-title">{challenge.title}</h1>

                <p className="coding-description">
                  {challenge.description}
                </p>

                <div className="coding-examples-heading">
                  <h2>Examples</h2>
                  <span>{examples.length} visible</span>
                </div>

                {examples.length === 0 ? (
                  <p>No visible examples were provided.</p>
                ) : (
                  examples.map((example, index) => (
                    <article
                      className="coding-example"
                      key={example.position}
                    >
                      <h3>Example {index + 1}</h3>

                      <span className="coding-field-label">
                        Function arguments
                      </span>
                      <pre tabIndex={0}>
                        <code>{JSON.stringify(example.input)}</code>
                      </pre>

                      <span className="coding-field-label">
                        Expected output
                      </span>
                      <pre tabIndex={0}>
                        <code>{JSON.stringify(example.expected_output)}</code>
                      </pre>
                    </article>
                  ))
                )}

                <p className="coding-hint">
                  Each input array contains the arguments passed to solve().
                  Hidden test cases are evaluated when you submit.
                </p>
              </div>
            </section>

            <div className="coding-right">
              <section className="coding-editor-area" aria-label="Solution editor">
                <Suspense
                  fallback={
                    <div className="coding-editor-loading" role="status">
                      Loading editor…
                    </div>
                  }
                >
                  <CodeEditor
                    key={`${interviewId}:${challenge.version_id}`}
                    interviewId={interviewId}
                    starterCode={challenge.starter_code}
                    onSubmitted={handleSubmitted}
                  />
                </Suspense>
              </section>

              <section className="coding-results" aria-label="Submission results">
                {executionUrl ? (
                  <ExecutionResults
                    key={executionUrl}
                    executionUrl={executionUrl}
                  />
                ) : (
                  <div className="coding-results-empty">
                    <strong>Execution results</strong>
                    <p>
                      Submit your solution to see its verdict and test results.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </main>
        </>
      ) : null}
    </div>
  )
}