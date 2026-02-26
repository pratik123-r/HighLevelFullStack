import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { AuditLog } from '../models/AuditLog.js';

export class AuditLogWorker {
  constructor(auditService, seatRepository) {
    this.auditService = auditService;
    this.seatRepository = seatRepository;

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
    const { operationType, eventId, showId, userId, seatId, bookingId, adminId, outcome, reason, metadata, timestamp } = job.data;

    try {
      // Extract seat IDs from bookingId if available and not already in metadata
      let enhancedMetadata = { ...metadata };

      if (bookingId && (!metadata?.seatIds || !Array.isArray(metadata.seatIds) || metadata.seatIds.length === 0)) {
        try {
          const seats = await this.seatRepository.findByBookingId(bookingId);
          if (seats.length > 0) {
            enhancedMetadata.seatIds = seats.map(s => s.id);
          }
        } catch (error) {
          console.error(`Failed to fetch seat IDs from bookingId ${bookingId}:`, error);
        }
      }

      const seatIds = enhancedMetadata.seatIds && Array.isArray(enhancedMetadata.seatIds)
        ? enhancedMetadata.seatIds
        : (seatId ? [seatId] : []);
      const denormalized = await this.auditService.fetchDenormalizedData({
        userId,
        adminId,
        showId,
        bookingId,
        seatId,
        seatIds: seatIds.length > 0 ? seatIds : undefined,
      });
      enhancedMetadata = { ...enhancedMetadata, denormalized };

      let resolvedEventId = eventId;
      if (!resolvedEventId && showId && this.auditService.showRepository) {
        try {
          const show = await this.auditService.showRepository.findById(showId);
          if (show) resolvedEventId = show.eventId;
        } catch (error) {
          console.error('Failed to fetch eventId from show for audit log:', error);
        }
      }

      const query = {
        operationType,
        outcome,
      };

      if (bookingId) query.bookingId = bookingId;
      if (seatId) query.seatId = seatId;
      if (userId) query.userId = userId;
      if (showId) query.showId = showId;
      if (adminId) query.adminId = adminId;

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
        eventId: resolvedEventId ?? null,
        showId,
        userId,
        seatId: seatId || null,
        bookingId,
        adminId,
        outcome,
        reason,
        metadata: enhancedMetadata,
        timestamp: logTimestamp instanceof Date ? logTimestamp : new Date(logTimestamp),
      });
    } catch (error) {
      console.error(`Failed to write audit log for job ${job.id}:`, error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Audit log job ${job.id} completed`);
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

