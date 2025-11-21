// backend/server.js
import Fastify from 'fastify' 
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import jwt from '@fastify/jwt'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import fs from 'fs'
import path from 'path'
import os from 'os'

const fastify = Fastify({ logger: true })
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const connection = new IORedis(REDIS_URL)

// simple in-memory user store for demo (replace with Postgres)
const users = new Map()
users.set('demo@local', { id: 'u1', email: 'demo@local', password: 'demo123' })

fastify.register(cors, { origin: true })
fastify.register(multipart)
fastify.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' })

// BullMQ queue
const importQueue = new Queue('importQueue', { connection })

// auth routes
fastify.post('/api/auth/login', async (req, reply) => {
  const { email, password } = req.body
  const user = users.get(email)
  if (!user || user.password !== password) {
    return reply.code(401).send({ error: 'invalid credentials' })
  }
  const token = fastify.jwt.sign({ id: user.id, email: user.email })
  return { token }
})

// Google OAuth redirect to Google (basic stub)
// In production, redirect user to Google OAuth consent screen
fastify.get('/api/auth/google', async (req, reply) => {
  // Ideally start OAuth flow; for now redirect to demo editor
  return reply.redirect('/editor.html')
})

// notes stub
fastify.get('/api/notes', async (req, reply) => {
  return [{ id: 'local-1', title: 'Demo Note', body: '# Hello' }]
})

// import endpoint: accepts multipart file, enqueues job
fastify.post('/api/import', async (req, reply) => {
  const parts = await req.parts()
  let filePart = null
  const formData = {}
  for await (const part of parts) {
    if (part.file) {
      filePart = part
    } else {
      formData[part.fieldname] = part.value
    }
  }
  if (!filePart) {
    return reply.code(400).send({ error: 'no file' })
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-import-'))
  const filename = path.join(tmpDir, filePart.filename || 'upload.bin')
  const writeStream = fs.createWriteStream(filename)
  await new Promise((res, rej) => {
    filePart.file.pipe(writeStream)
    filePart.file.on('end', res)
    filePart.file.on('error', rej)
  })

  // Enqueue job: send file path & options
  const job = await importQueue.add('import-file', {
    filepath: filename,
    filename: filePart.filename,
    ocr: formData['ocr'] === '1' || formData['ocr'] === 'true',
    mode: formData['mode'] || 'single'
  })

  return reply.code(202).send({ jobId: job.id, status: 'queued' })
})

fastify.get('/api/import/:jobId/status', async (req, reply) => {
  const { jobId } = req.params
  // naive: try fetch job via importQueue.getJob
  try {
    const job = await importQueue.getJob(jobId)
    if (!job) return { jobId, status: 'not_found' }
    const state = await job.getState()
    return { jobId, status: state, progress: job.progress || 0, result: job.returnvalue || null }
  } catch (e) {
    return { jobId, status: 'error', message: e.message }
  }
})

const start = async () => {
  try {
    await fastify.listen({ port: 4000, host: '0.0.0.0' })
    fastify.log.info('Server listening on port 4000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
