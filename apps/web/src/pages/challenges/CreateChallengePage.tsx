import { apiFetch } from '../../lib/apiFetch'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

type Organization = {
  id: string
  name: string
  role: 'ADMIN' | 'INTERVIEWER'
}

type TestDraft = {
  id: string
  input: string
  expectedOutput: string
  isHidden: boolean
}

function newTest(isHidden = true): TestDraft {
  return {
    id: crypto.randomUUID(),
    input: '',
    expectedOutput: '',
    isHidden,
  }
}

export default function CreateChallengePage() {
  const { organizationId } = useParams()
  const navigate = useNavigate()

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [starterCode, setStarterCode] = useState(
    'function solve(a, b) {\n  // Write your solution here\n}',
  )
  const [tests, setTests] = useState<TestDraft[]>(() => [newTest(false)])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  const organizationPath = organizationId
    ? `/organizations/${encodeURIComponent(organizationId)}`
    : '/dashboard'

  useEffect(() => {
    let ignore = false

    async function checkAccess() {
      setCheckingAccess(true)
      setAccessError('')
      setOrganization(null)

      try {
        const response = await apiFetch('/api/organizations', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (ignore) return

        if (response.status === 401) {
          void navigate('/login', { replace: true })
          return
        }

        if (!response.ok) {
          throw new Error('Unable to check your organization access.')
        }

        const data = await response.json()

        if (ignore) return

        const organizations: Organization[] = data.organizations
        const current = organizations.find(
          (item) => item.id === organizationId,
        )

        if (!current) {
          throw new Error('Organization unavailable or access denied.')
        }

        setOrganization(current)
      } catch (error) {
        if (!ignore) {
          setAccessError(
            error instanceof Error
              ? error.message
              : 'Unable to reach the server.',
          )
        }
      } finally {
        if (!ignore) setCheckingAccess(false)
      }
    }

    void checkAccess()

    return () => {
      ignore = true
    }
  }, [organizationId, attempt, navigate])

  function updateTest(id: string, changes: Partial<TestDraft>) {
    setTests((current) =>
      current.map((test) =>
        test.id === id ? { ...test, ...changes } : test,
      ),
    )
  }

  function removeTest(id: string) {
    setTests((current) =>
      current.length > 1
        ? current.filter((test) => test.id !== id)
        : current,
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving || !organizationId || organization?.role !== 'ADMIN') return

    setError('')

    if (!title.trim() || !description.trim() || !starterCode.trim()) {
      setError('Title, description and starter code cannot be blank.')
      return
    }

    const preparedTests = []

    for (const [index, test] of tests.entries()) {
      let input: unknown
      let expectedOutput: unknown

      try {
        input = JSON.parse(test.input)
      } catch {
        setError(`Test ${index + 1}: enter a valid JSON array for the input.`)
        return
      }

      if (!Array.isArray(input)) {
        setError(`Test ${index + 1}: input must be an array, such as [2, 3].`)
        return
      }

      try {
        expectedOutput = JSON.parse(test.expectedOutput)
      } catch {
        setError(`Test ${index + 1}: expected output must be valid JSON.`)
        return
      }

      preparedTests.push({
        input,
        expectedOutput,
        isHidden: test.isHidden,
      })
    }

    setSaving(true)

    try {
      const response = await apiFetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/challenges`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            starterCode,
            tests: preparedTests,
          }),
        },
      )

      if (response.status === 401) {
        setError('Your login has expired. Sign in in another tab, then retry.')
        return
      }

      if (response.status === 403) {
        setError('Administrator access is required to create challenges.')
        return
      }

      if (response.status === 413) {
        setError('This challenge is too large. Reduce the description or test data.')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Unable to create the challenge.')
        return
      }

      setCreated(true)
    } catch {
      setError(
        'Unable to confirm creation. Check the organization’s challenge list before retrying.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="challenge-create-page">
      <header className="workspace-topbar">
        <p>
          <Link to={organizationPath}>Organization</Link>
          <span aria-hidden="true">/</span>
          <strong>Create challenge</strong>
        </p>

        <Link to={organizationPath}>Back to organization</Link>
      </header>

      <main className="workspace-main">
        {checkingAccess ? (
          <div className="workspace-state" role="status">
            <h2>Checking your access.</h2>
            <p>Loading your organization membership.</p>
          </div>
        ) : accessError ? (
          <div className="workspace-state" role="alert">
            <h2>Unable to open the form.</h2>
            <p>{accessError}</p>

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
            <p>Only organization administrators can create challenges.</p>
          </div>
        ) : created ? (
          <div className="workspace-state">
            <p className="workspace-eyebrow" role="status">
              Challenge created
            </p>

            <h2>Your next interview starts here.</h2>
            <p>
              Version 1 has been saved. You can find it in your organization’s
              Challenges section.
            </p>

            <p>
              <Link to={organizationPath}>Return to organization →</Link>
            </p>
          </div>
        ) : (
          <>
            <section className="workspace-heading">
              <div>
                <p className="workspace-eyebrow">{organization.name}</p>
                <h1>Create a challenge<span>.</span></h1>

                <p className="workspace-description">
                  Define the problem, provide starter code and decide how
                  solutions will be tested.
                </p>
              </div>
            </section>

            <form className="challenge-form" onSubmit={handleSubmit}>
              <fieldset disabled={saving} className="challenge-form-fields">
                <legend>Challenge details</legend>

                <label htmlFor="challenge-title">Title</label>
                <input
                  id="challenge-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="For example, Add Two Numbers"
                  maxLength={200}
                  required
                />

                <label htmlFor="challenge-description">Problem description</label>
                <textarea
                  id="challenge-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Explain the task, inputs, outputs and constraints."
                  rows={6}
                  maxLength={12000}
                  required
                />

                <label htmlFor="challenge-starter">JavaScript starter code</label>
                <textarea
                  id="challenge-starter"
                  className="challenge-form-code"
                  value={starterCode}
                  onChange={(event) => setStarterCode(event.target.value)}
                  rows={7}
                  maxLength={10000}
                  spellCheck={false}
                  aria-describedby="starter-help"
                  required
                />

                <p id="starter-help" className="challenge-form-help">
                  Define a function named solve. Each test’s input array
                  supplies its arguments.
                </p>
              </fieldset>

              <section
                className="challenge-form-tests"
                aria-labelledby="test-cases-title"
              >
                <div className="challenge-panel-heading">
                  <h2 id="test-cases-title">Test cases</h2>
                  <span className="workspace-role">{tests.length} / 100</span>
                </div>

                <p className="challenge-form-help">
                  Inputs use JSON arrays, such as [2, 3]. Expected outputs
                  use JSON values, such as 5, true, "hello" or [1, 2].
                </p>

                {tests.map((test, index) => (
                  <fieldset
                    key={test.id}
                    disabled={saving}
                    className="challenge-form-test"
                  >
                    <legend>Test {index + 1}</legend>

                    <div className="challenge-test-values">
                      <div>
                        <label htmlFor={`input-${test.id}`}>
                          Input arguments
                        </label>
                        <textarea
                          id={`input-${test.id}`}
                          value={test.input}
                          onChange={(event) =>
                            updateTest(test.id, { input: event.target.value })
                          }
                          placeholder="[2, 3]"
                          rows={3}
                          spellCheck={false}
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor={`output-${test.id}`}>
                          Expected output
                        </label>
                        <textarea
                          id={`output-${test.id}`}
                          value={test.expectedOutput}
                          onChange={(event) =>
                            updateTest(test.id, {
                              expectedOutput: event.target.value,
                            })
                          }
                          placeholder="5"
                          rows={3}
                          spellCheck={false}
                          required
                        />
                      </div>
                    </div>

                    <div className="challenge-test-actions">
                      <label className="challenge-checkbox">
                        <input
                          type="checkbox"
                          checked={test.isHidden}
                          onChange={(event) =>
                            updateTest(test.id, {
                              isHidden: event.target.checked,
                            })
                          }
                        />
                        Hidden test — don’t show as an example
                      </label>

                      <button
                        type="button"
                        onClick={() => removeTest(test.id)}
                        disabled={tests.length === 1}
                        aria-label={`Remove test ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  </fieldset>
                ))}

                <button
                  type="button"
                  className="challenge-add-test"
                  disabled={saving || tests.length >= 100}
                  onClick={() =>
                    setTests((current) =>
                      current.length < 100
                        ? [...current, newTest()]
                        : current,
                    )
                  }
                >
                  + Add test case
                </button>
              </section>

              {error && (
                <p className="workspace-error" role="alert">
                  {error}
                </p>
              )}

              <div className="challenge-form-footer">
                <p>Saving creates version 1 of this challenge.</p>

                <button
                  type="submit"
                  className="challenge-save"
                  disabled={saving}
                >
                  {saving ? 'Creating challenge…' : 'Create challenge'}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  )
}