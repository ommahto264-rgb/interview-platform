import { useEffect, useState } from 'react'

type CaseResult = {
  position: number
  verdict: string
  duration_ms: number
}

type Execution = {
  submission_id: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  verdict: string | null
  passed_tests: number | null
  total_tests: number
  results: CaseResult[]
  error_code: string | null
}

type Props = {
  executionUrl: string
  audience?: 'candidate' | 'staff'
}



function readable(value: string) {
  return value.replaceAll('_', ' ').toLowerCase()
}

export default function ExecutionResults({
  executionUrl,
  audience = 'candidate',
}: Props) {
  const [execution, setExecution] = useState<Execution | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let checks = 0

    setExecution(null)
    setError('')
    setLoading(true)

    async function checkExecution() {
      try {
        const response = await fetch(executionUrl, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 401) {
          throw new Error(
            'Your session expired. Sign in again, then retry checking results.',
          )
        }

        if (!response.ok) {
          throw new Error('Unable to load execution results. Please retry.')
        }

        const data = await response.json()

        if (controller.signal.aborted) return

        const result: Execution = data.execution

        if (
          !result ||
          !['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'].includes(result.status) ||
          !Array.isArray(result.results)
        ) {
          throw new Error('The server returned invalid execution results.')
        }

        setExecution(result)
        setLoading(false)

        if (result.status === 'COMPLETED' || result.status === 'FAILED') {
          return
        }

        checks += 1

        if (checks >= 60) {
          setError(
            'Execution is taking longer than expected. Check again shortly. ' +
              'You do not need to resubmit your code.',
          )
          return
        }

        timer = setTimeout(() => {
          void checkExecution()
        }, 2000)
      } catch (error) {
        if (controller.signal.aborted) return

        setError(
          error instanceof Error
            ? error.message
            : 'Unable to reach the server.',
        )
        setLoading(false)
      }
    }

    void checkExecution()

    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [executionUrl, attempt])

  return (
    <section className="challenge-panel" aria-labelledby="results-title">
      <div className="challenge-panel-heading">
        <h2 id="results-title">Execution results</h2>

        {execution && (
          <span className="workspace-role">
            {readable(execution.status)}
          </span>
        )}
      </div>

      <div role="status" aria-live="polite">
        {loading && <p>Loading execution results…</p>}

        {execution?.status === 'QUEUED' && (
          <p>Your submission is queued for execution.</p>
        )}

        {execution?.status === 'RUNNING' && (
          <p>Your solution is running against the test cases.</p>
        )}

        {execution?.status === 'COMPLETED' && (
          <>
            <h3>
              {execution.verdict
                ? readable(execution.verdict)
                : 'Execution complete'}
            </h3>

            <p>
              {execution.passed_tests} / {execution.total_tests} tests passed.
            </p>
          </>
        )}

        {execution?.status === 'FAILED' && (
          <p>
            The execution service could not finish this submission.
            This is not a verdict on your solution.
          </p>
        )}
      </div>

      {execution?.status === 'COMPLETED' &&
        execution.results.length > 0 && (
          <div>
            <h3>
                {audience === 'staff' ? 'Test results' : 'Visible test results'}
            </h3>

            <ul>
              {execution.results.map((test) => (
                <li key={test.position}>
                  Test {test.position}: {readable(test.verdict)}
                  {' · '}
                  {test.duration_ms} ms
                </li>
              ))}
            </ul>
          </div>
        )}

      {execution?.status === 'COMPLETED' && (
        <p className="workspace-description">
            {audience === 'staff'
            ? 'Results include visible and hidden tests. Expected answers and execution logs are not displayed.'
            : 'The total includes hidden tests. Only visible test details are displayed.'}
        </p>
      )}

      {error && (
        <div role="alert">
          <p className="error-message">{error}</p>

          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Check results again
          </button>
        </div>
      )}
    </section>
  )
}