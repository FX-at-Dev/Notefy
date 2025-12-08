// backend/server.js
import 'dotenv/config'
import Fastify from 'fastify' 
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import jwt from '@fastify/jwt'
import oauthPlugin from '@fastify/oauth2'
import fastifyStatic from '@fastify/static'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const fastify = Fastify({ logger: true })
connectDB()

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

fastify.register(cors, { origin: true })
fastify.register(multipart)
fastify.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' })

// Serve static frontend files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../Frontend'),
  prefix: '/',
})

// BullMQ queue
const importQueue = new Queue('importQueue', { connection })

// Register Routes
fastify.register(authRoutes, { prefix: '/api/auth' })

// Google OAuth Configuration
fastify.register(oauthPlugin, {
  name: 'googleOAuth2',
  scope: ['profile', 'email'],
  credentials: {
    client: {
      id: process.env.GOOGLE_CLIENT_ID || 'CLIENT_ID_PLACEHOLDER',
      secret: process.env.GOOGLE_CLIENT_SECRET || 'CLIENT_SECRET_PLACEHOLDER'
    },
    auth: oauthPlugin.GOOGLE_CONFIGURATION
  },
  startRedirectPath: '/api/auth/google',
  callbackUri: 'http://localhost:4000/api/auth/google/callback'
})


// notes stub
fastify.get('/api/notes', async (req, reply) => {
  return [{ id: 'local-1', title: 'Demo Note', body: '# Hello' }]
})

// import endpoint: accepts multipart file, enqueues job
fastify.post('/api/import', async (req, reply) => {
  fastify.log.info('POST /api/import - starting multipart parse')
  
  let savedFilePath = null
  let savedFilename = null
  const formData = {}
  
  try {
    const parts = req.parts()
    for await (const part of parts) {
      if (part.file) {
        fastify.log.info({ filename: part.filename, mimetype: part.mimetype }, 'file part received')
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-import-'))
        const filename = path.join(tmpDir, part.filename || 'upload.bin')
        
        // Buffer and write immediately to avoid stream loss
        const buffer = await part.toBuffer()
        fs.writeFileSync(filename, buffer)
        
        savedFilePath = filename
        savedFilename = part.filename
        fastify.log.info({ path: filename, size: buffer.length }, 'file written successfully')
      } else {
        formData[part.fieldname] = part.value
        fastify.log.info({ field: part.fieldname, value: part.value }, 'form field received')
      }
    }
  } catch (parseErr) {
    fastify.log.error({ err: parseErr }, 'multipart parse failed')
    return reply.code(400).send({ error: 'multipart parse error: ' + parseErr.message })
  }

  if (!savedFilePath) {
    fastify.log.warn('no file part found in upload')
    return reply.code(400).send({ error: 'no file' })
  }

  try {
    fastify.log.info('enqueueing import job')
    const job = await importQueue.add('import-file', {
      filepath: savedFilePath,
      filename: savedFilename,
      ocr: formData['ocr'] === '1' || formData['ocr'] === 'true',
      mode: formData['mode'] || 'single'
    })
    fastify.log.info({ jobId: job.id }, 'job enqueued successfully')
    return reply.code(202).send({ jobId: job.id, status: 'queued' })
  } catch (err) {
    fastify.log.error({ err }, 'failed to enqueue job')
    return reply.code(500).send({ error: 'failed to queue job' })
  }
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
    const port = process.env.PORT || 4000
    await fastify.listen({ port, host: '0.0.0.0' })
    fastify.log.info(`Server listening on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
