import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './InterviewEvaluation.css'

type Recommendation = 'STRONG_NO' | 'NO' | 'YES' | 'STRONG_YES'

type Evaluation = {
  id: string
  reviewer_name: string
  problem_solving_score: number
  code_quality_score: number
  communication_score: number
  recommendation: Recommendation
  feedback: string
  created_at: string
}

type Props = {
  organizationId: string
  interviewId: string
  status: string
}

const recommendationLabels: Record<Recommendation, string> = {
  STRONG_NO: 'Strong no',
  NO: 'No',
  YES: 'Yes',
  STRONG_YES: 'Strong yes',
}

const scoreFields = [
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'codeQuality', label: 'Code quality' },
  { key: 'communication', label: 'Communication' },
] as const

export default function InterviewEvaluation({
  organizationId,
  interviewId,
  status,
}: Props) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [scores, setScores] = useState({
    problemSolving: '',
    codeQuality: '',
    communication: '',
  })
  const [recommendation, setRecommendation] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  const submitting = useRef(false)

  const endpoint =
    `/api/organizations/${encodeURIComponent(organizationId)}` +
    `/interviews/${encodeURIComponent(interviewId)}/evaluations`

  useEffect(() => {
    const controller = new AbortController()

    async function loadEvaluations() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await fetch(endpoint, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 401) {
          throw new Error('Your session expired. Please sign in again.')
        }

        if (!response.ok) {
          throw new Error('Unable to load evaluations or access was denied.')
        }

        const data = await response.json()

        if (
          !Array.isArray(data.evaluations) ||
          typeof data.hasSubmitted !== 'boolean'
        ) {
          throw new Error('The server returned incomplete evaluation details.')
        }

        if (controller.signal.aborted) return

        setEvaluations(data.evaluations)
        setHasSubmitted(data.hasSubmitted)
      } catch (error) {
        if (controller.signal.aborted) return

        setLoadError(
          error instanceof Error ? error.message : 'Unable to load evaluations.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadEvaluations()

    return () => controller.abort()
  }, [endpoint, attempt])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      submitting.current ||
      hasSubmitted ||
      loading ||
      loadError ||
      status !== 'COMPLETED'
    ) {
      return
    }

    setError('')
    setMessage('')

    const payload = {
      problemSolving: Number(scores.problemSolving),
      codeQuality: Number(scores.codeQuality),
      communication: Number(scores.communication),
      recommendation,
      feedback: feedback.trim(),
    }

    if (
      [payload.problemSolving, payload.codeQuality, payload.communication]
        .some((score) => !Number.isInteger(score) || score < 1 || score > 5)
    ) {
      setError('Choose a score from 1 to 5 for every category.')
      return
    }

    if (!Object.hasOwn(recommendationLabels, recommendation)) {
      setError('Choose a recommendation.')
      return
    }

    if (!payload.feedback || payload.feedback.length > 5000) {
      setError('Feedback must contain between 1 and 5,000 characters.')
      return
    }

    if (!window.confirm('Submit this evaluation? It cannot be edited afterward.')) {
      return
    }

    submitting.current = true
    setSaving(true)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.status === 401) {
        setError('Your session expired. Sign in before retrying.')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Unable to submit the evaluation.')

        if (response.status === 409) {
          setAttempt((value) => value + 1)
        }

        return
      }

      setHasSubmitted(true)
      setMessage('Evaluation submitted successfully.')
      setAttempt((value) => value + 1)
    } catch {
      setError(
        'Unable to confirm submission. Refresh evaluations before retrying.',
      )
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <section className="evaluation-panel" aria-labelledby="evaluation-title">
      <div className="evaluation-toolbar">
        <div>
          <h2 id="evaluation-title">Interview evaluation</h2>
          <p>Record your assessment using evidence from the interview.</p>
        </div>

        <button
          type="button"
          disabled={loading || saving}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {loading ? 'Loading…' : 'Refresh evaluations'}
        </button>
      </div>

      {message && <p className="evaluation-success" role="status">{message}</p>}
      {error && <p className="evaluation-error" role="alert">{error}</p>}

      {loading ? (
        <p role="status">Loading evaluations…</p>
      ) : loadError ? (
        <p className="evaluation-error" role="alert">{loadError}</p>
      ) : (
        <>
          {hasSubmitted ? (
            <div className="evaluation-notice">
              You have submitted your evaluation for this interview.
            </div>
          ) : status !== 'COMPLETED' ? (
            <div className="evaluation-notice">
              Evaluations can be submitted after the interview is completed.
            </div>
          ) : (
            <form className="evaluation-form" onSubmit={handleSubmit}>
              <h3>Your assessment</h3>
              <p>Rate each category from 1 (lowest) to 5 (highest).</p>

              <div className="evaluation-score-grid">
                {scoreFields.map(({ key, label }) => (
                  <div key={key}>
                    <label htmlFor={`evaluation-${key}`}>{label}</label>
                    <select
                      id={`evaluation-${key}`}
                      value={scores[key]}
                      onChange={(event) =>
                        setScores((previous) => ({
                          ...previous,
                          [key]: event.target.value,
                        }))
                      }
                      required
                      disabled={saving}
                    >
                      <option value="">Select score</option>
                      {[1, 2, 3, 4, 5].map((score) => (
                        <option key={score} value={score}>
                          {score} / 5
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <label htmlFor="evaluation-recommendation">Recommendation</label>
              <select
                id="evaluation-recommendation"
                value={recommendation}
                onChange={(event) => setRecommendation(event.target.value)}
                required
                disabled={saving}
              >
                <option value="">Select recommendation</option>
                {Object.entries(recommendationLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <label htmlFor="evaluation-feedback">Feedback</label>
              <textarea
                id="evaluation-feedback"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Describe strengths, areas for improvement, and specific examples."
                rows={6}
                maxLength={5000}
                aria-describedby="evaluation-feedback-help"
                required
                disabled={saving}
              />

              <p id="evaluation-feedback-help">
                {feedback.length.toLocaleString()} / 5,000 characters.
                Submitted evaluations cannot be edited.
              </p>

              <button
                type="submit"
                className="evaluation-submit"
                disabled={saving}
              >
                {saving ? 'Submitting…' : 'Submit evaluation'}
              </button>
            </form>
          )}

          <section aria-labelledby="saved-evaluations-title">
            <h3 id="saved-evaluations-title">Submitted evaluations</h3>

            {evaluations.length === 0 ? (
              <p>No evaluations have been submitted yet.</p>
            ) : (
              <div className="evaluation-list">
                {evaluations.map((evaluation) => (
                  <article className="evaluation-card" key={evaluation.id}>
                    <div className="evaluation-toolbar">
                      <div>
                        <h4>{evaluation.reviewer_name}</h4>
                        <time dateTime={evaluation.created_at}>
                          {new Date(evaluation.created_at).toLocaleString()}
                        </time>
                      </div>

                      <span className="workspace-role">
                        {recommendationLabels[evaluation.recommendation]}
                      </span>
                    </div>

                    <dl className="evaluation-score-grid">
                      <div>
                        <dt>Problem solving</dt>
                        <dd>{evaluation.problem_solving_score} / 5</dd>
                      </div>
                      <div>
                        <dt>Code quality</dt>
                        <dd>{evaluation.code_quality_score} / 5</dd>
                      </div>
                      <div>
                        <dt>Communication</dt>
                        <dd>{evaluation.communication_score} / 5</dd>
                      </div>
                    </dl>

                    <p className="evaluation-feedback">{evaluation.feedback}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}