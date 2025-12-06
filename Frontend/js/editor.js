import { initDB, saveNote, getNotes, getNote, deleteNote } from './db.js'
import { $ } from './app.js'
import MarkdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js'

// CodeMirror 6 imports via esm.sh (works without bundler)
import { EditorView, basicSetup } from 'https://esm.sh/@codemirror/basic-setup@0.19.1'
import { EditorState } from 'https://esm.sh/@codemirror/state@0.19.1'
import { markdown } from 'https://esm.sh/@codemirror/lang-markdown@0.19.2'
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6.2.0'

const md = new MarkdownIt()
let currentNote = null
let cmView = null
let currentTab = 'notes' // 'notes', 'archive', 'trash'

const preview = $('#preview')
const titleInput = $('#note-title')
const notesList = $('#notes-list')
const statusBar = $('#status-bar')

async function initEditor() {
  const root = document.getElementById('cm-root')
  const startState = EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      markdown(),
      oneDark
    ]
  })
  cmView = new EditorView({ state: startState, parent: root })
  // render the preview when doc changes
  cmView.dispatch = ((orig) => (tr) => {
    orig.call(cmView, tr)
    if (tr.docChanged) {
      renderPreview()
      debounceSave()
      statusBar.textContent = 'Editing...'
    }
  })(cmView.dispatch.bind(cmView))
}

async function renderPreview() {
  const text = cmView.state.doc.toString()
  preview.innerHTML = md.render(text || '')
}

async function loadNotesList() {
  const allNotes = await getNotes()
  const filtered = allNotes.filter(n => {
    if (currentTab === 'trash') return n.status === 'trash'
    if (currentTab === 'archive') return n.status === 'archived'
    return !n.status || n.status === 'active'
  })
  
  notesList.innerHTML = filtered.map(n => `
    <div class="note-item ${currentNote?.id === n.id ? 'active' : ''}" data-id="${n.id}">
      <div class="note-item-title">${n.title || 'Untitled'}</div>
      <div class="note-item-preview">${(n.body || '').slice(0, 50)}</div>
    </div>
  `).join('')
}

async function openNote(id) {
  const note = await getNote(id)
  if (!note) return
  currentNote = note
  titleInput.value = note.title || ''
  cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: note.body || '' } })
  renderPreview()
  statusBar.textContent = 'Loaded'
  window.__currentNoteId = note.id
  
  // Update UI based on status
  updateEditorButtons()
  loadNotesList() // to update active state
}

function updateEditorButtons() {
  const btnArchive = $('#btn-archive')
  const btnDelete = $('#btn-delete')
  
  if (currentNote?.status === 'trash') {
    btnArchive.textContent = '♻️' // Restore
    btnArchive.title = 'Restore Note'
    btnDelete.textContent = '❌' // Permanent Delete
    btnDelete.title = 'Permanently Delete'
  } else if (currentNote?.status === 'archived') {
    btnArchive.textContent = '📤' // Unarchive
    btnArchive.title = 'Unarchive Note'
    btnDelete.textContent = '🗑️'
    btnDelete.title = 'Move to Trash'
  } else {
    btnArchive.textContent = '📥'
    btnArchive.title = 'Archive Note'
    btnDelete.textContent = '🗑️'
    btnDelete.title = 'Move to Trash'
  }
}

async function newNote() {
  currentNote = { id: `local-${Date.now()}`, title:'', body:'', created_at:new Date().toISOString(), status: 'active' }
  titleInput.value = ''
  cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: '' } })
  renderPreview()
  updateEditorButtons()
  loadNotesList()
}

async function saveCurrent() {
  if (!currentNote) return
  const note = {
    ...currentNote,
    title: titleInput.value || 'Untitled',
    body: cmView.state.doc.toString() || '',
    updated_at: new Date().toISOString()
  }
  await saveNote(note)
  statusBar.textContent = 'Saved'
  loadNotesList()
}

async function archiveCurrent() {
  console.log('Archive clicked', currentNote)
  if (!currentNote) return alert('No note selected')
  
  if (currentNote.status === 'archived') {
    currentNote.status = 'active'
  } else if (currentNote.status === 'trash') {
    currentNote.status = 'active' // Restore
  } else {
    currentNote.status = 'archived'
  }
  console.log('Saving note status:', currentNote.status)
  await saveNote(currentNote)
  loadNotesList()
  updateEditorButtons()
}

async function deleteCurrent() {
  console.log('Delete clicked', currentNote)
  if (!currentNote) return alert('No note selected')

  if (currentNote.status === 'trash') {
    if (confirm('Permanently delete this note?')) {
      await deleteNote(currentNote.id)
      currentNote = null
      titleInput.value = ''
      cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: '' } })
      renderPreview()
    }
  } else {
    currentNote.status = 'trash'
    await saveNote(currentNote)
  }
  loadNotesList()
  updateEditorButtons()
}

document.addEventListener('DOMContentLoaded', async () => {
  await initDB()
  await initEditor()
  await loadNotesList()

  // handlers
  $('#btn-new').addEventListener('click', newNote)
  
  // Tab handlers
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'))
      e.target.classList.add('active')
      currentTab = e.target.dataset.tab
      loadNotesList()
    })
  })

  // Archive/Delete handlers
  $('#btn-archive').addEventListener('click', archiveCurrent)
  $('#btn-delete').addEventListener('click', deleteCurrent)

  notesList.addEventListener('click', (ev) => {
    const item = ev.target.closest('.note-item')
    if (item) {
      const id = item.dataset.id
      if (id) openNote(id)
    }
  })

  // quick keyboard
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='s') {
      e.preventDefault(); saveCurrent()
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='p') {
      e.preventDefault()
      $('#qs-modal').classList.remove('hidden')
      $('#qs-input').focus()
    }
  })
  // quick Draw modal opener
  $('#btn-draw').addEventListener('click', ()=> {
    $('#draw-modal').classList.remove('hidden')
  })
  // expose openNote globally for quickswitcher
  window.__openNote = openNote
})

// debounce helper
let saveTimer = null
function debounceSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveCurrent, 900)
}
