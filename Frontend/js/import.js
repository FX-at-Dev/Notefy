import { apiFetch } from './api.js'

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

    // basic client-side: upload to backend import endpoint
    status.textContent = 'Uploading...'
    const fd = new FormData()
    fd.append('file', file)
    fd.append('ocr', ocr ? '1' : '0')
    fd.append('mode', mode)

    try {
      const json = await apiFetch('/api/import', { method: 'POST', body: fd })
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
      const j = await apiFetch(`/api/import/${jobId}/status`)
      status.textContent = `Status: ${j.status}`
      if (j.status === 'completed' || j.status === 'failed') {
        done = true
        if (j.status === 'completed' && j.result && Array.isArray(j.result.notes) && j.result.notes.length) {
          status.innerHTML += `<div>Imported ${j.result.notes.length} note${j.result.notes.length>1?'s':''} into editor.</div>`
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
    } catch(e) {
      status.textContent = 'Error polling job: ' + e.message
      done = true
    }
  }
}
