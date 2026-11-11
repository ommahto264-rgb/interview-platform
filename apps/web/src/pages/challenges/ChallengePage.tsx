import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

type Challenge = {
  version_id: string
  challenge_id: string
  version_number: number
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

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export default function ChallengePage() {
  const { organizationId, versionId } = useParams()
  const navigate = useNavigate()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [examples, setExamples] = useState<Example[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadChallenge() {
      setLoading(true)
      setError('')
      setChallenge(null)
      setExamples([])

      if (!organizationId || !versionId) {
        setError('Organization or challenge version ID is missing.')
        setLoading(false)
        return
      }

      const url =
        `/api/organizations/${encodeURIComponent(organizationId)}` +
        `/challenge-versions/${encodeURIComponent(versionId)}`

      try {
        const response = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
        })

        if (ignore) return

        if (response.status === 401) {
          void navigate('/login', { replace: true })
          return
        }

        if (response.status === 403 || response.status === 404) {
          throw new Error(
            'This challenge is unavailable or you no longer have access.',
          )
        }

        if (!response.ok) {
          throw new Error('Unable to load the challenge. Please try again.')
        }

        const data = await response.json()

        if (ignore) return

        setChallenge(data.challenge)
        setExamples(data.examples)
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
  }, [organizationId, versionId, attempt, navigate])

  function retry() {
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  const organizationPath = organizationId
    ? `/organizations/${encodeURIComponent(organizationId)}`
    : '/dashboard'

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
          <p className="workspace-nav-label">Challenge details</p>

          <div className="workspace-sidebar-note">
            <span className="workspace-note-line" aria-hidden="true" />
            <p>A clear problem. Room to think.</p>
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
            <strong>Challenge details</strong>
          </p>

          {challenge && (
            <span className="workspace-role">
              Version {challenge.version_number}
            </span>
          )}
        </header>

        <main className="workspace-main">
          {loading ? (
            <div className="workspace-state" role="status">
              <h2>Loading the challenge.</h2>
              <p>Fetching the description, starter code and examples.</p>
            </div>
          ) : error ? (
            <div className="workspace-state" role="alert">
              <h2>Unable to open this challenge.</h2>
              <p>{error}</p>

              <button type="button" onClick={retry}>
                Try again
              </button>
            </div>
          ) : challenge ? (
            <>
              <section className="workspace-heading">
                <div>
                  <p className="workspace-eyebrow">
                    {challenge.language === 'javascript'
                      ? 'JavaScript'
                      : challenge.language}
                    {' · Version '}
                    {challenge.version_number}
                  </p>

                  <h1>{challenge.title}</h1>

                  <p className="workspace-description">
                    Review the problem and its visible examples before
                    using this version in an interview.
                  </p>
                </div>
              </section>

              <div className="challenge-layout">
                <section
                  className="challenge-panel"
                  aria-labelledby="problem-title"
                >
                  <p className="workspace-eyebrow">The problem</p>
                  <h2 id="problem-title">Description</h2>

                  <p className="challenge-description">
                    {challenge.description}
                  </p>
                </section>

                <section
                  className="challenge-panel"
                  aria-labelledby="starter-title"
                >
                  <div className="challenge-panel-heading">
                    <h2 id="starter-title">Starter code</h2>
                    <span className="workspace-role">
                      {challenge.language}
                    </span>
                  </div>

                  <pre
                    className="challenge-code"
                    tabIndex={0}
                    aria-label="Starter code"
                  >
                    <code>{challenge.starter_code}</code>
                  </pre>
                </section>
              </div>

              <section
                className="challenge-examples"
                aria-labelledby="examples-title"
              >
                <div className="challenge-panel-heading">
                  <h2 id="examples-title">Visible examples</h2>
                  <span className="workspace-role">
                    {examples.length} examples
                  </span>
                </div>

                {examples.length === 0 ? (
                  <div className="workspace-state">
                    <p>No visible examples were provided for this version.</p>
                  </div>
                ) : (
                  <div className="challenge-example-grid">
                    {examples.map((example, index) => (
                      <article
                        className="challenge-panel"
                        key={example.position}
                      >
                        <h3>Example {index + 1}</h3>

                        <p className="challenge-value-label">
                          Function arguments
                        </p>

                        <pre
                          className="challenge-code"
                          tabIndex={0}
                          aria-label={`Example ${index + 1} input`}
                        >
                          <code>{formatJson(example.input)}</code>
                        </pre>

                        <p className="challenge-value-label">
                          Expected output
                        </p>

                        <pre
                          className="challenge-code"
                          tabIndex={0}
                          aria-label={`Example ${index + 1} expected output`}
                        >
                          <code>{formatJson(example.expected_output)}</code>
                        </pre>
                      </article>
                    ))}
                  </div>
                )}

                <p className="workspace-description">
                  Each input array contains the arguments passed to solve().
                  Hidden test cases are not displayed here.
                </p>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}