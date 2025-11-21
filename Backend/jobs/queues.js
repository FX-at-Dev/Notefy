// backend/jobs/queues.js
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')

export const importQueue = new Queue('importQueue', { connection })
export const exportQueue = new Queue('exportQueue', { connection })
