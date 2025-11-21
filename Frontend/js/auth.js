import { apiFetch } from './api.js'
import { $ } from './app.js'

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form')
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = $('#email').value
      const password = $('#password').value
      try {
        const res = await fetch('/api/auth/login', {
          method:'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const j = await res.json()
        localStorage.setItem('auth_token', j.token)
        alert('Signed in (demo).')
        window.location.href = '/editor.html'
      } catch (err) {
        alert('Sign in failed: ' + err.message)
      }
    })
  }

  const googleBtn = document.getElementById('google-signin')
  if (googleBtn) googleBtn.addEventListener('click', ()=> {
    // Redirect to backend's Google OAuth endpoint
    window.location.href = '/api/auth/google'
  })
})
