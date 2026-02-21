import { Queue } from 'bullmq';
import { redis } from '../config/redis.js';

export class QueueService {
  constructor() {
    this.seatGenerationQueue = new Queue('seat-generation', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.auditLogQueue = new Queue('audit-log', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
  }

  /**
   * @param {string} showId
   * @returns {Promise<void>}
   */
  async enqueueSeatGeneration(showId) {
    await this.seatGenerationQueue.add('generate-seats', { showId });
    console.log(`Enqueued seat generation job for show: ${showId}`);
  }

  /**
   * @param {any} data
   * @param {string} jobId
   * @returns {Promise<void>}
   */
  async enqueueAuditLog(data, jobId) {
    await this.auditLogQueue.add('write-audit-log', data, {
      jobId,
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep max 1000 completed jobs
      },
    });
  }

  /**
   * @returns {Queue}
   */
  getSeatGenerationQueue() {
    return this.seatGenerationQueue;
  }

  /**
   * @returns {Queue}
   */
  getAuditLogQueue() {
    return this.auditLogQueue;
  }
}

