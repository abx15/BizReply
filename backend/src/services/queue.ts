import { sendWhatsAppMessage } from './whatsapp';
import { IBusiness } from '../models/Business';
import Redis from 'ioredis';

interface QueueJob {
  to: string;
  content: string;
  business: IBusiness;
}

class BroadcastQueue {
  private memoryQueue: QueueJob[] = [];
  private redisClient: Redis | null = null;
  private isProcessing = false;
  private processInterval = 1000;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && redisUrl !== 'redis://127.0.0.1:6379') {
      try {
        console.log(`[Queue] Connecting to Redis at ${redisUrl}...`);
        this.redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000
        });

        this.redisClient.on('error', (err: any) => {
          console.warn('[Queue] Redis connection failed, falling back to memory queue.');
          this.redisClient = null;
        });
      } catch (err: any) {
        console.warn('[Queue] Redis initialization failed, using in-memory queue.');
      }
    } else {
      console.log('[Queue] Using in-memory queue for broadcasts.');
    }
  }

  public async addJob(to: string, content: string, business: IBusiness): Promise<void> {
    const job: QueueJob = { to, content, business };
    
    if (this.redisClient) {
      try {
        await this.redisClient.rpush('broadcast_queue', JSON.stringify(job));
        this.startProcessing();
        return;
      } catch (err: any) {
        console.warn('[Queue] Failed to push to Redis. Adding to memory queue instead.');
      }
    }

    this.memoryQueue.push(job);
    this.startProcessing();
  }

  private startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processNext();
  }

  private async processNext() {
    let job: QueueJob | null = null;

    if (this.redisClient) {
      try {
        const jobStr = await this.redisClient.lpop('broadcast_queue');
        if (jobStr) {
          job = JSON.parse(jobStr);
        }
      } catch (err: any) {
        console.error('[Queue] Error reading from Redis queue:', err);
      }
    }

    if (!job && this.memoryQueue.length > 0) {
      job = this.memoryQueue.shift() || null;
    }

    if (!job) {
      this.isProcessing = false;
      return;
    }

    try {
      console.log(`[Queue] Processing job: Sending broadcast to ${job.to}`);
      await sendWhatsAppMessage(job.to, job.content, job.business);
    } catch (err: any) {
      console.error(`[Queue] Error sending broadcast to ${job.to}:`, err);
    }

    setTimeout(() => this.processNext(), this.processInterval);
  }
}

export const broadcastQueue = new BroadcastQueue();
