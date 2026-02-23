import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockRedis = {};

// Mock ioredis using unstable_mockModule for ES modules
jest.unstable_mockModule('ioredis', () => {
  return {
    default: jest.fn().mockImplementation(() => mockRedis),
  };
});

const mockQueue = jest.fn();
jest.unstable_mockModule('bullmq', () => ({
  Queue: mockQueue,
}));

// Mock the config file to export our mock redis
jest.unstable_mockModule('../../src/config/redis.js', () => ({
  redis: mockRedis,
}));

const { QueueService } = await import('../../src/services/QueueService.js');

describe('QueueService', () => {
  let queueService;
  let mockSeatGenerationQueue;
  let mockAuditLogQueue;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSeatGenerationQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    mockAuditLogQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-456' }),
    };

    mockQueue.mockImplementation((name) => {
      if (name === 'seat-generation') {
        return mockSeatGenerationQueue;
      }
      if (name === 'audit-log') {
        return mockAuditLogQueue;
      }
      return {};
    });

    queueService = new QueueService();
  });

  describe('constructor', () => {
    it('should create queues with correct configuration', () => {
      expect(mockQueue).toHaveBeenCalledWith('seat-generation', {
        connection: mockRedis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      expect(mockQueue).toHaveBeenCalledWith('audit-log', {
        connection: mockRedis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });
    });
  });

  describe('enqueueSeatGeneration', () => {
    it('should enqueue seat generation job', async () => {
      const showId = 'show-123';

      await queueService.enqueueSeatGeneration(showId);

      expect(mockSeatGenerationQueue.add).toHaveBeenCalledWith('generate-seats', { showId });
    });

    it('should handle errors gracefully', async () => {
      mockSeatGenerationQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(queueService.enqueueSeatGeneration('show-123')).rejects.toThrow(
        'Queue error'
      );
    });
  });

  describe('enqueueAuditLog', () => {
    it('should enqueue audit log job with idempotency key', async () => {
      const logData = {
        operationType: 'BOOK',
        bookingId: 'booking-123',
        outcome: 'SUCCESS',
      };
      const jobId = 'job-id-123';

      await queueService.enqueueAuditLog(logData, jobId);

      expect(mockAuditLogQueue.add).toHaveBeenCalledWith('write-audit-log', logData, {
        jobId,
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      mockAuditLogQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(
        queueService.enqueueAuditLog({ operationType: 'BOOK' }, 'job-id')
      ).rejects.toThrow('Queue error');
    });
  });

  describe('getSeatGenerationQueue', () => {
    it('should return seat generation queue', () => {
      const queue = queueService.getSeatGenerationQueue();

      expect(queue).toBe(mockSeatGenerationQueue);
    });
  });

  describe('getAuditLogQueue', () => {
    it('should return audit log queue', () => {
      const queue = queueService.getAuditLogQueue();

      expect(queue).toBe(mockAuditLogQueue);
    });
  });
});

