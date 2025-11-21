import { apiFetch } from './api.js'
import { $ } from './app.js'

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('import-form')
  const fileInput = document.getElementById('file')
  const status = document.getElementById('import-status')

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const file = fileInput.files[0]
    if (!file) return alert('Choose a file')
    const ocr = document.getElementById('opt-ocr').checked
    const mode = document.getElementById('import-mode').value

    // basic client-side: upload to backend import endpoint
    status.textContent = 'Uploading...'
    const fd = new FormData()
    fd.append('file', file)
    fd.append('ocr', ocr ? '1' : '0')
    fd.append('mode', mode)

    try {
      const res = await fetch('/api/import', { method:'POST', body: fd })
      const json = await res.json()
      status.innerHTML = `Job queued: ${json.jobId}. Polling...`
      pollJob(json.jobId)
    } catch(err) {
      status.textContent = 'Upload failed: ' + err.message
    }
  })
})

async function pollJob(jobId) {
  const status = document.getElementById('import-status')
  let done = false
  while(!done) {
    await new Promise(r => setTimeout(r, 1200))
    try {
      const res = await fetch(`/api/import/${jobId}/status`)
      const j = await res.json()
      status.textContent = `Status: ${j.status}`
      if (j.status === 'completed' || j.status === 'failed') {
        done = true
        if (j.result && j.result.createdNotes) status.innerHTML += `<div>Notes created: ${j.result.createdNotes.join(', ')}</div>`
      }
    } catch(e) {
      status.textContent = 'Error polling job: ' + e.message
      done = true
    }
  }
}
