import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { AuditLog } from '../models/AuditLog.js';

export class AuditLogWorker {
  constructor() {
    this.worker = new Worker(
      'audit-log',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: 10,
      }
    );

    this.setupEventHandlers();
  }

  async processJob(job) {
    const { operationType, eventId, showId, userId, seatId, bookingId, outcome, reason, metadata, timestamp } = job.data;

    try {
      const query = {
        operationType,
        outcome,
      };

      if (bookingId) query.bookingId = bookingId;
      if (seatId) query.seatId = seatId;
      if (userId) query.userId = userId;
      if (showId) query.showId = showId;

      let logTimestamp;
      if (timestamp) {
        logTimestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);
      } else {
        logTimestamp = new Date();
      }

      if (isNaN(logTimestamp.getTime())) {
        logTimestamp = new Date();
      }

      query.timestamp = {
        $gte: new Date(logTimestamp.getTime() - 10000),
        $lte: new Date(logTimestamp.getTime() + 10000),
      };

      const existingLog = await AuditLog.findOne(query);

      if (existingLog) {
        console.log(`Audit log already exists for job ${job.id}, skipping duplicate`);
        return;
      }

      await AuditLog.create({
        operationType,
        eventId,
        showId,
        userId,
        seatId,
        bookingId,
        outcome,
        reason,
        metadata,
        timestamp: logTimestamp instanceof Date ? logTimestamp : new Date(logTimestamp),
      });
    } catch (error) {
      console.error(`Failed to write audit log for job ${job.id}:`, error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.worker.on('completed', () => {
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Audit log job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('Audit log worker error:', err);
    });
  }

  async close() {
    await this.worker.close();
  }
}

