let refreshInProgress: Promise<boolean> | null = null
let sessionVersion = 0

async function refreshSession(): Promise<boolean> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  })

  if (response.status === 401) return false

  if (!response.ok) {
    throw new Error('Unable to renew your session. Please try again.')
  }

  sessionVersion++
  return true
}

function renewOnce() {
  if (!refreshInProgress) {
    refreshInProgress = refreshSession().finally(() => {
      refreshInProgress = null
    })
  }

  return refreshInProgress
}

// Use for protected API routes with no body or a JSON string body.
export async function apiFetch(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: string | null } = {},
): Promise<Response> {
  const versionAtStart = sessionVersion
  const send = () => fetch(path, { ...options, credentials: 'include' })

  const response = await send()
  if (response.status !== 401) return response

  options.signal?.throwIfAborted()

  if (versionAtStart === sessionVersion) {
    const renewed = await renewOnce()
    if (!renewed) return response
  }

  options.signal?.throwIfAborted()
  return send()
}