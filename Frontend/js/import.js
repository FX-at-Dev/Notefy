// js/import.js - standalone import page (no dependencies on api.js)

const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.__API_BASE__) return window.__API_BASE__
  if (typeof window === 'undefined') return ''
  const { host, port, protocol } = window.location
  if (port === '3000' || host.includes(':3000') || host.startsWith('frontend.') || protocol === 'file:') {
    return 'http://localhost:4000'
  }
  return ''
})()

function postMessageToEditor(title, text) {
  if (!text) return
  if (!window.parent || window.parent === window) return
  try {
    window.parent.postMessage({ type: 'imported-file', title, text }, '*')
  } catch (err) {
    console.error('Failed to send note to editor via postMessage', err)
  }
}

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

    status.textContent = 'Uploading...'
    const fd = new FormData()
    fd.append('file', file)
    fd.append('ocr', ocr ? '1' : '0')
    fd.append('mode', mode)

    try {
      const res = await fetch(`${API_BASE}/api/import`, { method: 'POST', body: fd })
      if (!res.ok) {
        const txt = await res.text().catch(() => '<no body>')
        throw new Error(`Server returned ${res.status}: ${txt}`)
      }
      const json = await res.json()
      status.innerHTML = `Job queued: ${json.jobId}. Polling...`
      pollJob(json.jobId)
    } catch (err) {
      console.error('Import upload failed', err)
      status.textContent = 'Upload failed: ' + (err.message || String(err))
    }
  })
})

async function pollJob(jobId) {
  const status = document.getElementById('import-status')
  let done = false
  while (!done) {
    await new Promise(r => setTimeout(r, 1200))
    try {
      const res = await fetch(`${API_BASE}/api/import/${jobId}/status`)
      const j = await res.json()
      status.textContent = `Status: ${j.status}`
      if (j.status === 'completed' || j.status === 'failed') {
        done = true
        if (j.status === 'completed' && j.result && Array.isArray(j.result.notes) && j.result.notes.length) {
          status.innerHTML += `<div>Imported ${j.result.notes.length} note${j.result.notes.length > 1 ? 's' : ''} into editor.</div>`
          j.result.notes.forEach((note, idx) => {
            const title = note?.title || `Imported note ${idx + 1}`
            const text = note?.body || note?.content || ''
            postMessageToEditor(title, text)
          })
        }
        if (j.status === 'completed' && j.result && j.result.createdNotes) {
          status.innerHTML += `<div>Notes created: ${j.result.createdNotes.join(', ')}</div>`
        }
      }
    } catch (e) {
      console.error('Error polling job', e)
      status.textContent = 'Error polling job: ' + (e.message || String(e))
      done = true
    }
  }
}
