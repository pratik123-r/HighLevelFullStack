import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockAuditLog = {
  findOne: jest.fn(),
  create: jest.fn(),
};

const mockRedis = {};

// Mock ioredis using unstable_mockModule for ES modules
jest.unstable_mockModule('ioredis', () => {
  return {
    default: jest.fn().mockImplementation(() => mockRedis),
  };
});

// Mock the config file to export our mock redis
jest.unstable_mockModule('../../src/config/redis.js', () => ({
  redis: mockRedis,
}));

const mockWorker = jest.fn();
jest.unstable_mockModule('bullmq', () => ({
  Worker: mockWorker,
}));

// Export Worker for test assertions
const { Worker } = await import('bullmq');

jest.unstable_mockModule('../../src/models/AuditLog.js', () => ({
  AuditLog: mockAuditLog,
}));

const mockPrisma = {
  seat: {
    findMany: jest.fn(),
  },
};

// Mock PrismaClient before importing anything that uses it
jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.unstable_mockModule('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

const { AuditLogWorker } = await import('../../src/workers/auditLogWorker.js');

describe('AuditLogWorker', () => {
  let auditLogWorker;
  let mockWorkerInstance;
  let mockSeatRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWorkerInstance = {
      on: jest.fn(),
      close: jest.fn(),
    };

    mockWorker.mockImplementation(() => mockWorkerInstance);

    mockSeatRepository = {
      findById: jest.fn(),
    };

    auditLogWorker = new AuditLogWorker();
    // The worker instance is stored in auditLogWorker.worker
    // We need to ensure it's the mock instance
    auditLogWorker.worker = mockWorkerInstance;
  });

  describe('constructor', () => {
    it('should create worker with correct configuration', () => {
      expect(Worker).toHaveBeenCalledWith(
        'audit-log',
        expect.any(Function),
        {
          connection: expect.any(Object),
          concurrency: 10,
        }
      );
    });

    it('should setup event handlers', () => {
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('processJob', () => {
    const mockJob = {
      id: 'job-123',
      data: {
        operationType: 'BOOK',
        bookingId: 'booking-123',
        userId: 'user-123',
        showId: 'show-123',
        outcome: 'SUCCESS',
        timestamp: new Date(),
      },
    };

    it('should process job successfully without duplicate', async () => {
      mockAuditLog.findOne.mockResolvedValue(null);
      mockAuditLog.create.mockResolvedValue({ id: 'log-123' });

      await auditLogWorker.processJob(mockJob);

      expect(mockAuditLog.findOne).toHaveBeenCalled();
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: 'BOOK',
          bookingId: 'booking-123',
          outcome: 'SUCCESS',
        })
      );
    });

    it('should skip duplicate logs', async () => {
      mockAuditLog.findOne.mockResolvedValue({ id: 'existing-log' });

      await auditLogWorker.processJob(mockJob);

      expect(mockAuditLog.create).not.toHaveBeenCalled();
    });

    it('should fetch seat IDs from booking when not in metadata', async () => {
      const seats = [
        { id: 'seat-1', seatNumber: 1 },
        { id: 'seat-2', seatNumber: 2 },
      ];

      mockPrisma.seat.findMany.mockResolvedValue(seats);
      mockAuditLog.findOne.mockResolvedValue(null);
      mockAuditLog.create.mockResolvedValue({});

      const jobData = {
        ...mockJob.data,
        metadata: {},
      };

      await auditLogWorker.processJob({ ...mockJob, data: jobData });

      expect(mockPrisma.seat.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-123' },
        select: { id: true, seatNumber: true },
        orderBy: { seatNumber: 'asc' },
      });
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            seatIds: ['seat-1', 'seat-2'],
          }),
        })
      );
    });

    it('should not fetch seat IDs when already in metadata', async () => {
      mockAuditLog.findOne.mockResolvedValue(null);
      mockAuditLog.create.mockResolvedValue({});

      const jobData = {
        ...mockJob.data,
        metadata: { seatIds: ['seat-1'] },
      };

      await auditLogWorker.processJob({ ...mockJob, data: jobData });

      expect(mockPrisma.seat.findMany).not.toHaveBeenCalled();
    });

    it('should handle timestamp conversion', async () => {
      const timestamp = '2024-01-01T00:00:00Z';
      mockAuditLog.findOne.mockResolvedValue(null);
      mockAuditLog.create.mockResolvedValue({});

      const jobData = {
        ...mockJob.data,
        timestamp,
      };

      await auditLogWorker.processJob({ ...mockJob, data: jobData });

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );
    });

    it('should use current date when timestamp is invalid', async () => {
      mockAuditLog.findOne.mockResolvedValue(null);
      mockAuditLog.create.mockResolvedValue({});

      const jobData = {
        ...mockJob.data,
        timestamp: 'invalid-date',
      };

      await auditLogWorker.processJob({ ...mockJob, data: jobData });

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle errors during processing', async () => {
      mockAuditLog.findOne.mockRejectedValue(new Error('Database error'));

      await expect(auditLogWorker.processJob(mockJob)).rejects.toThrow('Database error');
    });

    it('should handle errors when fetching seat IDs', async () => {
      mockPrisma.seat.findMany.mockRejectedValue(new Error('Database error'));
      mockAuditLog.findOne.mockResolvedValue(null);
      mockAuditLog.create.mockResolvedValue({});

      const jobData = {
        ...mockJob.data,
        metadata: {},
      };

      await auditLogWorker.processJob({ ...mockJob, data: jobData });

      expect(mockAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close worker', async () => {
      mockWorkerInstance.close.mockResolvedValue(undefined);

      await auditLogWorker.close();

      expect(mockWorkerInstance.close).toHaveBeenCalled();
    });
  });
});

