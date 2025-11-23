// backend/jobs/importWorker.js
import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import fs from 'fs'
import fetch from 'node-fetch'
import FormData from 'form-data'

function slidesToNotes(slides = [], mode = 'single') {
  const slideNotes = slides.map((slide, idx) => {
    const title = slide.title || `Slide ${idx + 1}`
    const text = (slide.text || '').trim()
    const images = Array.isArray(slide.images) ? slide.images : []
    const imageBlocks = images.map((img, imgIdx) => `![${title} image ${imgIdx + 1}](${img})`).join('\n\n')
    const bodyParts = [text, imageBlocks].filter(Boolean)
    return {
      title,
      body: bodyParts.join('\n\n').trim()
    }
  })

  if (mode === 'pages') {
    return slideNotes.length ? slideNotes : [{ title: 'Imported slides', body: '' }]
  }

  const separator = mode === 'slides' ? '\n\n---\n\n' : '\n\n'
  const combinedBody = slideNotes.map(note => note.body).filter(Boolean).join(separator)
  return [{
    title: 'Imported slides',
    body: combinedBody || slideNotes.map((_, idx) => `Slide ${idx + 1}`).join('\n') || ''
  }]
}
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

const pythonWorkerUrl = process.env.PYTHON_WORKER_URL || 'http://localhost:8000'

const worker = new Worker('importQueue', async job => {
  console.log('Import job started', job.id, job.name, job.data.filename)
  const { filepath, filename, ocr, mode } = job.data
  const ext = (filename || '').split('.').pop().toLowerCase()
  job.updateProgress(10)

  if (ext === 'pptx') {
    // send file to python worker for parsing
    const body = new FormData()
    const fileStream = fs.createReadStream(filepath)
    body.append('file', fileStream, filename)
    body.append('mode', mode)
    const resp = await fetch(`${pythonWorkerUrl}/parse-pptx`, { method:'POST', body })
    const json = await resp.json()
    // json should contain slides[] with text + images (images as base64 or saved files)
    job.updateProgress(80)
    // Create notes from slides (stub)
    const notes = slidesToNotes(json.slides, mode)
    job.updateProgress(100)
    const createdNotes = notes.map((_, idx) => `note-pptx-${Date.now()}-${idx}`)
    return { createdNotes, notes }
  } else if (ext === 'pdf') {
    // stub: parse PDF with a simple extractor or poppler / pdf-lib (not implemented here)
    // For now, just echo file name and pretend note created
    job.updateProgress(80)
    const createdNotes = [`note-pdf-${Date.now()}`]
    const notes = [{ title: filename || 'Imported PDF', body: `Imported PDF "${filename}". OCR requested: ${ocr ? 'yes' : 'no'}.` }]
    job.updateProgress(100)
    return { createdNotes, notes }
  } else {
    throw new Error('Unsupported file type')
  }
}, { connection })

worker.on('completed', job => {
  console.log('Import job completed', job.id, job.returnvalue)
})
worker.on('failed', (job, err) => {
  console.error('Import job failed', job.id, err)
})
worker.on('error', (err) => {
  console.error('Worker error', err)
})
