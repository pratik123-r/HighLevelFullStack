import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// OperationType constant
const OperationType = {
  SEAT_GENERATION: 'SEAT_GENERATION',
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

const mockWorkerInstance = {
  on: jest.fn(),
  close: jest.fn(),
};

const mockWorker = jest.fn(() => mockWorkerInstance);

jest.unstable_mockModule('bullmq', () => ({
  Worker: mockWorker,
}));

const { SeatGenerationWorker } = await import('../../src/workers/seatGenerationWorker.js');
const { ShowStatus } = await import('@prisma/client');

describe('SeatGenerationWorker', () => {
  let seatGenerationWorker;
  let mockSeatRepository;
  let mockShowRepository;
  let mockAuditService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSeatRepository = {
      createMany: jest.fn(),
    };

    mockShowRepository = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockAuditService = {
      logSuccess: jest.fn().mockResolvedValue(undefined),
      logFailure: jest.fn().mockResolvedValue(undefined),
    };

    seatGenerationWorker = new SeatGenerationWorker(
      mockSeatRepository,
      mockShowRepository,
      mockAuditService
    );
    // The worker instance is stored in seatGenerationWorker.worker
    // We need to ensure it's the mock instance
    seatGenerationWorker.worker = mockWorkerInstance;
  });

  describe('constructor', () => {
    it('should create worker with correct configuration', () => {
      expect(mockWorker).toHaveBeenCalledWith(
        'seat-generation',
        expect.any(Function),
        {
          connection: expect.any(Object),
          concurrency: 5,
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
        showId: 'show-123',
      },
    };

    it('should process job successfully', async () => {
      const show = {
        id: 'show-123',
        totalSeats: 100,
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
        createdByAdminId: 'admin-123',
      };

      mockShowRepository.findById.mockResolvedValue(show);
      mockSeatRepository.createMany.mockResolvedValue({ count: 100 });
      mockShowRepository.updateStatus.mockResolvedValue({});

      await seatGenerationWorker.processJob(mockJob);

      expect(mockShowRepository.findById).toHaveBeenCalledWith('show-123');
      expect(mockSeatRepository.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            showId: 'show-123',
            seatNumber: 1,
            status: 'AVAILABLE',
          }),
        ])
      );
      expect(mockSeatRepository.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            seatNumber: 100,
          }),
        ])
      );
      expect(mockShowRepository.updateStatus).toHaveBeenCalledWith(
        'show-123',
        ShowStatus.AVAILABLE
      );
      expect(mockAuditService.logSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: OperationType.SEAT_GENERATION,
          showId: 'show-123',
          adminId: 'admin-123',
        })
      );
    });

    it('should throw error when show not found', async () => {
      mockShowRepository.findById.mockResolvedValue(null);

      await expect(seatGenerationWorker.processJob(mockJob)).rejects.toThrow(
        'Show not found: show-123'
      );

      expect(mockAuditService.logFailure).toHaveBeenCalled();
    });

    it('should throw error when show is not in SEAT_GENERATION_IN_PROGRESS status', async () => {
      const show = {
        id: 'show-123',
        status: ShowStatus.AVAILABLE,
      };

      mockShowRepository.findById.mockResolvedValue(show);

      await expect(seatGenerationWorker.processJob(mockJob)).rejects.toThrow(
        'Show is not in SEAT_GENERATION_IN_PROGRESS status'
      );

      expect(mockAuditService.logFailure).toHaveBeenCalled();
    });

    it('should update show status to DRAFT on error', async () => {
      const show = {
        id: 'show-123',
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
      };

      mockShowRepository.findById.mockResolvedValue(show);
      mockSeatRepository.createMany.mockRejectedValue(new Error('Database error'));
      mockShowRepository.updateStatus.mockResolvedValue({});

      await expect(seatGenerationWorker.processJob(mockJob)).rejects.toThrow('Database error');

      expect(mockShowRepository.updateStatus).toHaveBeenCalledWith(
        'show-123',
        ShowStatus.DRAFT
      );
      expect(mockAuditService.logFailure).toHaveBeenCalled();
    });

    it('should handle error when updating show status fails', async () => {
      const show = {
        id: 'show-123',
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
      };

      mockShowRepository.findById.mockResolvedValue(show);
      mockSeatRepository.createMany.mockRejectedValue(new Error('Database error'));
      mockShowRepository.updateStatus.mockRejectedValue(new Error('Update failed'));

      await expect(seatGenerationWorker.processJob(mockJob)).rejects.toThrow('Database error');

      expect(mockAuditService.logFailure).toHaveBeenCalled();
    });

    it('should fetch adminId for failure log when show fetch fails', async () => {
      const show = {
        id: 'show-123',
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
        createdByAdminId: 'admin-123',
      };

      mockShowRepository.findById
        .mockResolvedValueOnce(show)
        .mockResolvedValueOnce(show);
      mockSeatRepository.createMany.mockRejectedValue(new Error('Database error'));
      mockShowRepository.updateStatus.mockResolvedValue({});

      await expect(seatGenerationWorker.processJob(mockJob)).rejects.toThrow('Database error');

      expect(mockAuditService.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-123',
        })
      );
    });

    it('should handle null adminId when show fetch fails', async () => {
      const show = {
        id: 'show-123',
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
      };

      mockShowRepository.findById
        .mockResolvedValueOnce(show)
        .mockResolvedValueOnce(null);
      mockSeatRepository.createMany.mockRejectedValue(new Error('Database error'));
      mockShowRepository.updateStatus.mockResolvedValue({});

      await expect(seatGenerationWorker.processJob(mockJob)).rejects.toThrow('Database error');

      expect(mockAuditService.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: null,
        })
      );
    });

    it('should generate correct number of seats', async () => {
      const show = {
        id: 'show-123',
        totalSeats: 50,
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
        createdByAdminId: 'admin-123',
      };

      mockShowRepository.findById.mockResolvedValue(show);
      mockSeatRepository.createMany.mockResolvedValue({ count: 50 });
      mockShowRepository.updateStatus.mockResolvedValue({});

      await seatGenerationWorker.processJob(mockJob);

      expect(mockSeatRepository.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ seatNumber: 1 }),
          expect.objectContaining({ seatNumber: 50 }),
        ])
      );
      const seats = mockSeatRepository.createMany.mock.calls[0][0];
      expect(seats).toHaveLength(50);
    });
  });

  describe('close', () => {
    it('should close worker', async () => {
      mockWorkerInstance.close.mockResolvedValue(undefined);

      await seatGenerationWorker.close();

      expect(mockWorkerInstance.close).toHaveBeenCalled();
    });
  });
});

