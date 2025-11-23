// js/api.js
const DEFAULT_API_BASE = (() => {
  try {
    if (typeof window === 'undefined') return ''
    const { host, port, protocol } = window.location
    if (port === '3000' || host.includes(':3000')) return 'http://localhost:4000'
    if (host.startsWith('frontend.') || protocol === 'file:') return 'http://localhost:4000'
    return ''
  } catch (_) {
    return ''
  }
})()

const BASE = typeof window !== 'undefined' && window.__API_BASE__ != null
  ? window.__API_BASE__
  : DEFAULT_API_BASE

export async function apiFetch(path, opts = {}) {
  const headers = opts.headers || {}
  const token = localStorage.getItem('auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (fetchOptions.body instanceof FormData) {
    // Allow browser to set boundaries automatically by deleting headers it cannot calculate
    if (fetchOptions.headers && fetchOptions.headers['Content-Type']) {
      delete fetchOptions.headers['Content-Type']
    }
  }
  const res = await fetch((BASE||'') + path, fetchOptions)
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`${res.status} ${t}`)
  }
  return res.json()
}
