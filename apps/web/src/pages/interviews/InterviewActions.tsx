import { apiFetch } from '../../lib/apiFetch'
import { useState } from 'react'

type Props = {
  organizationId: string
  interviewId: string
  status: string
  onUpdated: () => void
}

export default function InterviewActions({
  organizationId,
  interviewId,
  status,
  onUpdated,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function updateStatus(action: 'start' | 'complete') {
    if (saving) return

    setSaving(true)
    setError('')

    try {
      const response = await apiFetch(
        `/api/organizations/${encodeURIComponent(organizationId)}` +
          `/interviews/${encodeURIComponent(interviewId)}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )

      if (response.status === 401) {
        setError('Your session has expired. Please sign in again.')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Unable to update the interview.')
        return
      }

      setConfirming(false)
      onUpdated()
    } catch {
      setError(
        'Unable to confirm the update. Refresh the page to check the interview status before trying again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="challenge-panel" aria-labelledby="controls-title">
      <p className="workspace-eyebrow">Session controls</p>
      <h2 id="controls-title">Manage interview</h2>

      {status === 'SCHEDULED' && (
        <>
          <p className="workspace-description">
            Start during the scheduled time after the candidate has
            accepted their invitation.
          </p>

          <button
            type="button"
            disabled={saving}
            onClick={() => void updateStatus('start')}
          >
            {saving ? 'Starting…' : 'Start interview'}
          </button>
        </>
      )}

      {status === 'IN_PROGRESS' && (
        <>
          <p className="workspace-description">
            Completing this interview closes it to new candidate submissions.
          </p>

          {confirming ? (
            <div>
              <p>Are you ready to complete this interview?</p>

              <button
                type="button"
                disabled={saving}
                onClick={() => void updateStatus('complete')}
              >
                {saving ? 'Completing…' : 'Yes, complete interview'}
              </button>

              {' '}

              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirming(false)}
              >
                Keep interview open
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)}>
              Complete interview
            </button>
          )}
        </>
      )}

      {status === 'COMPLETED' && (
        <p className="workspace-description">
          This interview is complete.
        </p>
      )}

      {!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(status) && (
        <p className="workspace-description">
          No session controls are available for this status.
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}