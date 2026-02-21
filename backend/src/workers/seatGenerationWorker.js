import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { ShowStatus } from '@prisma/client';
import { OperationType } from '../models/AuditLog.js';

export class SeatGenerationWorker {
  constructor(seatRepository, showRepository, auditService) {
    this.seatRepository = seatRepository;
    this.showRepository = showRepository;
    this.auditService = auditService;

    this.worker = new Worker(
      'seat-generation',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: 5,
      }
    );

    this.setupEventHandlers();
  }

  async processJob(job) {
    const { showId } = job.data;

    console.log(`Processing seat generation for show: ${showId}`);

    try {
      const show = await this.showRepository.findById(showId);
      if (!show) {
        throw new Error(`Show not found: ${showId}`);
      }

      if (show.status !== ShowStatus.SEAT_GENERATION_IN_PROGRESS) {
        throw new Error(
          `Show is not in SEAT_GENERATION_IN_PROGRESS status. Current: ${show.status}`
        );
      }

      const seats = Array.from({ length: show.totalSeats }, (_, i) => ({
        showId,
        seatNumber: i + 1,
        status: 'AVAILABLE',
      }));

      await this.seatRepository.createMany(seats);
      await this.showRepository.updateStatus(showId, ShowStatus.AVAILABLE);

      await this.auditService.logSuccess({
        operationType: OperationType.SEAT_GENERATION,
        showId,
        metadata: {
          totalSeats: show.totalSeats,
          jobId: job.id,
        },
      });

      console.log(`Successfully generated ${show.totalSeats} seats for show: ${showId}`);
    } catch (error) {
      console.error(`Failed to generate seats for show ${showId}:`, error.message);

      try {
        await this.showRepository.updateStatus(showId, ShowStatus.DRAFT);
      } catch (updateError) {
        console.error('Failed to update show status:', updateError);
      }

      await this.auditService.logFailure({
        operationType: OperationType.SEAT_GENERATION,
        showId,
        reason: error.message || 'Unknown error during seat generation',
        metadata: {
          jobId: job.id,
          error: error.toString(),
        },
      });

      throw error;
    }
  }

  setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  }

  async close() {
    await this.worker.close();
  }
}

