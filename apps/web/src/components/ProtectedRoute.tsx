import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { apiFetch } from '../lib/apiFetch'

type SessionStatus = 'checking' | 'authenticated' | 'anonymous' | 'error'

export default function ProtectedRoute() {
  const [status, setStatus] = useState<SessionStatus>('checking')
  const [attempt, setAttempt] = useState(0)
  const location = useLocation()

  useEffect(() => {
    let ignore = false

    async function checkSession() {
      try {
        const response = await apiFetch('/api/auth/session', {
  cache: 'no-store',
})

        if (ignore) return

        if (response.ok) {
          setStatus('authenticated')
        } else if (response.status === 401) {
          setStatus('anonymous')
        } else {
          setStatus('error')
        }
      } catch {
        if (!ignore) {
          setStatus('error')
        }
      }
    }

    void checkSession()

    return () => {
      ignore = true
    }
  }, [attempt])

  function retry() {
    setStatus('checking')
    setAttempt((value) => value + 1)
  }

  if (status === 'checking') {
    return (
      <main className="login-page">
        <p role="status">Checking your session…</p>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>Unable to connect</h1>

          <p className="subtitle" role="alert">
            We couldn’t check your login session. Please try again.
          </p>

          <button onClick={retry}>Try again</button>
        </section>
      </main>
    )
  }

  if (status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return <Outlet />
}