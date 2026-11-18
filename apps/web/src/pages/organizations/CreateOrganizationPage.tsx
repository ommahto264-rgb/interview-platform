import { apiFetch } from '../../lib/apiFetch'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

type Organization = {
  id: string
  name: string
  slug: string
  role: string
}

export default function CreateOrganizationPage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState('')

  const submitting = useRef(false)

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting.current || created) return

    const cleanName = name.trim()
    const cleanSlug = slug.trim().toLowerCase()

    setError('')

    if (cleanName.length < 2 || cleanName.length > 100) {
      setError('Name must contain between 2 and 100 characters.')
      return
    }

    if (
      cleanSlug.length < 3 ||
      cleanSlug.length > 60 ||
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleanSlug)
    ) {
      setError(
        'Slug must be 3–60 characters: lowercase letters, numbers, ' +
          'and single hyphens between words.',
      )
      return
    }

    submitting.current = true
    setSaving(true)

    try {
      const response = await apiFetch('/api/organizations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cleanName,
          slug: cleanSlug,
        }),
      })

      if (response.status === 401) {
        setError(
          'Your session expired. Sign in in another tab, then try again.',
        )
        return
      }

      if (!response.ok) {
        const data = await response.json()
        setError(data.error ?? 'Unable to create the organization.')
        return
      }

      // Creation succeeded. Never offer another create attempt
      // just because the following navigation lookup fails.
      setCreated(true)

      try {
        const listResponse = await apiFetch('/api/organizations', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (!listResponse.ok) return

        const data = await listResponse.json()

        if (!Array.isArray(data.organizations)) return

        const organization = data.organizations.find(
          (item: Organization) => item.slug === cleanSlug,
        )

        if (organization) {
          void navigate(
            `/organizations/${encodeURIComponent(organization.id)}`,
            { replace: true },
          )
        }
      } catch {
        // Keep the success screen and dashboard link available.
      }
    } catch {
      setError(
        'Unable to confirm creation. Check your dashboard before retrying; ' +
          'the organization may already have been created.',
      )
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Link to="/dashboard" className="brand">
          ← Back to dashboard
        </Link>

        {created ? (
          <div role="status">
            <h1>Organization created.</h1>

            <p className="subtitle">
              You are its administrator. Open your dashboard to access it.
            </p>

            <Link to="/dashboard">Go to dashboard →</Link>
          </div>
        ) : (
          <>
            <h1>Create your organization</h1>

            <p className="subtitle">
              Set up a workspace for your hiring team, challenges and interviews.
              You’ll become its administrator.
            </p>

            <form onSubmit={handleCreate}>
              <label htmlFor="organization-name">Organization name</label>

              <input
                id="organization-name"
                name="name"
                type="text"
                autoComplete="organization"
                placeholder="Acme Engineering"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={100}
                required
                disabled={saving}
              />

              <label htmlFor="organization-slug">Organization slug</label>

              <input
                id="organization-slug"
                name="slug"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="acme-engineering"
                value={slug}
                onChange={(event) =>
                  setSlug(event.target.value.toLowerCase())
                }
                minLength={3}
                maxLength={60}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                aria-describedby="organization-slug-help"
                required
                disabled={saving}
              />

              <p id="organization-slug-help" className="subtitle">
                A unique identifier, such as acme-engineering.
                Use lowercase letters, numbers and hyphens.
              </p>

              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={saving}>
                {saving ? 'Creating organization…' : 'Create organization'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}