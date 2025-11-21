import Konva from 'https://cdn.jsdelivr.net/npm/konva@8.4.3/konva.min.js'
import { saveNote, initDB, getNote } from './db.js'
import { $ } from './app.js'

let stage, layer, isDrawing = false, line

async function initDrawPad() {
  const container = document.getElementById('draw-container')
  // clear previous content
  container.innerHTML = ''
  stage = new Konva.Stage({
    container: 'draw-container',
    width: container.clientWidth,
    height: container.clientHeight
  })
  layer = new Konva.Layer()
  stage.add(layer)
  stage.on('mousedown touchstart', (e) => {
    isDrawing = true
    const pos = stage.getPointerPosition()
    line = new Konva.Line({
      stroke: 'black',
      strokeWidth: parseInt($('#draw-size').value || 4),
      globalCompositeOperation: 'source-over',
      points: [pos.x, pos.y],
      lineCap: 'round',
      lineJoin: 'round'
    })
    layer.add(line)
  })
  stage.on('mousemove touchmove', () => {
    if (!isDrawing) return
    const pos = stage.getPointerPosition()
    const pts = line.points().concat([pos.x, pos.y])
    line.points(pts)
    layer.draw()
  })
  stage.on('mouseup touchend', () => {
    isDrawing = false
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  await initDB()
  $('#draw-close').addEventListener('click',()=> {
    $('#draw-modal').classList.add('hidden')
  })
  $('#draw-clear').addEventListener('click',()=>{
    layer && layer.destroyChildren()
    layer.draw()
  })
  $('#draw-save').addEventListener('click', async ()=>{
    // export png data URL
    const dataUrl = stage.toDataURL({ pixelRatio: 1 })
    // attach to current open note (simple flow: load open note id from window.__currentNoteId)
    // For demo: create a dummy note with the image embedded as data url in markdown: ![](dataUrl)
    let noteId = window.__currentNoteId
    if (!noteId) {
      // create a new note quickly
      const newNote = { id: `local-${Date.now()}`, title:'Drawing', body:`![drawing](${dataUrl})`, created_at:new Date().toISOString() }
      await saveNote(newNote)
      alert('Drawing saved as a new local note.')
    } else {
      const note = await getNote(noteId)
      note.body = (note.body || '') + `\n\n![]( ${dataUrl} )`
      await saveNote(note)
      alert('Drawing attached to current note.')
    }
    $('#draw-modal').classList.add('hidden')
  })
  $('#draw-size').addEventListener('input', (e)=> {
    // new stroke width will be read on next mousedown
  })

  // lazy init Konva when modal opens
  document.getElementById('btn-draw')?.addEventListener('click', ()=> {
    setTimeout(()=> {
      if (!stage) initDrawPad()
    }, 80)
  })
})
