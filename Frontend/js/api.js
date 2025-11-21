// js/api.js
const BASE = window.__API_BASE__ || ''

export async function apiFetch(path, opts = {}) {
  const headers = opts.headers || {}
  const token = localStorage.getItem('auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch((BASE||'') + path, {...opts, headers})
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`${res.status} ${t}`)
  }
  return res.json()
}
