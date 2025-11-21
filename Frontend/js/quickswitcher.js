import { getNotes } from './db.js'
const modal = document.getElementById('qs-modal')
const input = document.getElementById('qs-input')
const results = document.getElementById('qs-results')

input?.addEventListener('input', async (e) => {
  const q = (e.target.value||'').toLowerCase().trim()
  if (!q) { results.innerHTML = ''; return }
  const notes = await getNotes()
  const hits = notes.filter(n => (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q)).slice(0,12)
  results.innerHTML = hits.map(h => `<div class="note-item" data-id="${h.id}">${h.title||'Untitled'}</div>`).join('')
})

results?.addEventListener('click', (ev) => {
  const id = ev.target.dataset.id
  if (!id) return
  modal.classList.add('hidden')
  // open note via editor global
  if (window.__openNote) window.__openNote(id)
})
// close on Escape
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') modal.classList.add('hidden')
})
