import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3.2.3/dist/dexie.mjs'

const db = new Dexie('NotesAppDB')
db.version(1).stores({
  notes: 'id,title,updated_at,created_at',
  attachments: 'id,note_id,filename',
  mru: 'id,ref'
})

export async function initDB(){ return db.open() }

export async function saveNote(note) {
  note.updated_at = new Date().toISOString()
  if (!note.id) note.id = `local-${Date.now()}`
  await db.notes.put(note)
  // update MRU
  await db.mru.put({id:note.id, ref:note.id})
  return note
}

export async function getNotes() {
  return db.notes.orderBy('updated_at').reverse().toArray()
}

export async function getNote(id) {
  return db.notes.get(id)
}

export async function deleteNote(id) {
  await db.notes.delete(id)
  await db.mru.delete(id)
}

export async function clearDB() {
  await db.delete()
}
