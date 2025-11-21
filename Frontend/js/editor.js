import { initDB, saveNote, getNotes, getNote } from './db.js'
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
  const notes = await getNotes()
  notesList.innerHTML = notes.map(n => `<div class="note-item" data-id="${n.id}">${n.title || 'Untitled'}</div>`).join('')
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
}

async function newNote() {
  currentNote = { id: `local-${Date.now()}`, title:'', body:'', created_at:new Date().toISOString() }
  titleInput.value = ''
  cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: '' } })
  renderPreview()
}

async function saveCurrent() {
  const note = {
    id: currentNote?.id,
    title: titleInput.value || 'Untitled',
    body: cmView.state.doc.toString() || '',
    created_at: currentNote?.created_at || new Date().toISOString()
  }
  await saveNote(note)
  statusBar.textContent = 'Saved'
  loadNotesList()
}

document.addEventListener('DOMContentLoaded', async () => {
  await initDB()
  await initEditor()
  await loadNotesList()

  // handlers
  $('#btn-new').addEventListener('click', newNote)
  notesList.addEventListener('click', (ev) => {
    const id = ev.target.dataset.id
    if (id) openNote(id)
  })
  $('#btn-quickswitch').addEventListener('click', () => {
    $('#qs-modal').classList.remove('hidden')
    $('#qs-input').focus()
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
