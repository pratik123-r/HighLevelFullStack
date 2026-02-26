import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockExec = jest.fn();
const mockLimit = jest.fn().mockReturnValue({ exec: mockExec });
const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
const mockFind = jest.fn().mockReturnValue({ sort: mockSort });

const mockAuditLog = {
  find: mockFind,
  countDocuments: jest.fn().mockReturnValue({
    exec: jest.fn(),
  }),
};

const AuditOutcome = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
};

const OperationType = {
  BOOK: 'BOOK',
  CANCEL: 'CANCEL',
  LOCK: 'LOCK',
};

jest.unstable_mockModule('../../src/models/AuditLog.js', () => ({
  AuditOutcome,
  OperationType,
  AuditLog: mockAuditLog,
}));

const { AuditService } = await import('../../src/services/AuditService.js');

describe('AuditService', () => {
  let auditService;
  let mockQueueService;
  let mockUserRepository;
  let mockAdminRepository;
  let mockShowRepository;
  let mockBookingRepository;
  let mockSeatRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock chains
    mockExec.mockClear();
    mockLimit.mockClear();
    mockSort.mockClear();
    mockFind.mockClear();
    mockAuditLog.countDocuments.mockClear();
    
    // Re-setup the mock chain - ensure each returns the next in chain
    mockFind.mockReturnValue({ sort: mockSort });
    mockSort.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ exec: mockExec });

    mockQueueService = {
      enqueueAuditLog: jest.fn().mockResolvedValue(undefined),
    };

    mockUserRepository = {
      findById: jest.fn(),
    };

    mockAdminRepository = {
      findById: jest.fn(),
    };

    mockShowRepository = {
      findById: jest.fn(),
    };

    mockBookingRepository = {
      findById: jest.fn(),
    };

    mockSeatRepository = {
      findById: jest.fn(),
    };

    auditService = new AuditService(
      mockQueueService,
      mockUserRepository,
      mockAdminRepository,
      mockShowRepository,
      mockBookingRepository,
      mockSeatRepository
    );
  });

  describe('generateIdempotencyKey', () => {
    it('should generate consistent hash for same input', () => {
      const data = {
        operationType: OperationType.BOOK,
        bookingId: 'booking-123',
        userId: 'user-123',
        outcome: AuditOutcome.SUCCESS,
        timestamp: new Date('2024-01-01'),
      };

      const key1 = auditService.generateIdempotencyKey(data);
      const key2 = auditService.generateIdempotencyKey(data);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex string
    });

    it('should generate different keys for different inputs', () => {
      const data1 = {
        operationType: OperationType.BOOK,
        bookingId: 'booking-123',
        outcome: AuditOutcome.SUCCESS,
      };
      const data2 = {
        operationType: OperationType.CANCEL,
        bookingId: 'booking-123',
        outcome: AuditOutcome.SUCCESS,
      };

      const key1 = auditService.generateIdempotencyKey(data1);
      const key2 = auditService.generateIdempotencyKey(data2);

      expect(key1).not.toBe(key2);
    });

    it('should handle missing optional fields', () => {
      const data = {
        operationType: OperationType.BOOK,
        outcome: AuditOutcome.SUCCESS,
      };

      const key = auditService.generateIdempotencyKey(data);

      expect(key).toBeDefined();
      expect(key).toHaveLength(64);
    });
  });

  describe('fetchDenormalizedData', () => {
    it('should fetch user data when userId provided', async () => {
      const user = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      };

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await auditService.fetchDenormalizedData({ userId: 'user-123' });

      expect(result.user).toEqual({
        name: user.name,
        email: user.email,
      });
    });

    it('should fetch admin data when adminId provided', async () => {
      const admin = {
        id: 'admin-123',
        name: 'Admin User',
        email: 'admin@example.com',
      };

      mockAdminRepository.findById.mockResolvedValue(admin);

      const result = await auditService.fetchDenormalizedData({ adminId: 'admin-123' });

      expect(result.admin).toEqual({
        name: admin.name,
        email: admin.email,
      });
    });

    it('should fetch show data when showId provided', async () => {
      const show = {
        id: 'show-123',
        status: 'AVAILABLE',
        totalSeats: 100,
        event: {
          name: 'Test Event',
          venue: {
            name: 'Test Venue',
            totalSeatCount: 100,
          },
        },
      };

      mockShowRepository.findById.mockResolvedValue(show);

      const result = await auditService.fetchDenormalizedData({ showId: 'show-123' });

      expect(result.show).toEqual({
        status: show.status,
        totalSeats: show.totalSeats,
        event: {
          name: show.event.name,
          venue: {
            name: show.event.venue.name,
            totalSeatCount: show.event.venue.totalSeatCount,
          },
        },
      });
    });

    it('should fetch booking data when bookingId provided', async () => {
      const booking = {
        id: 'booking-123',
        status: 'CONFIRMED',
      };

      mockBookingRepository.findById.mockResolvedValue(booking);

      const result = await auditService.fetchDenormalizedData({ bookingId: 'booking-123' });

      expect(result.booking).toEqual({
        status: booking.status,
      });
    });

    it('should fetch single seat data when seatId provided', async () => {
      const seat = {
        id: 'seat-123',
        seatNumber: 1,
        status: 'AVAILABLE',
      };

      mockSeatRepository.findById.mockResolvedValue(seat);

      const result = await auditService.fetchDenormalizedData({ seatId: 'seat-123' });

      expect(result.seat).toEqual({
        seatNumber: seat.seatNumber,
        status: seat.status,
      });
    });

    it('should fetch multiple seats data when seatIds provided', async () => {
      const seats = [
        { id: 'seat-1', seatNumber: 1, status: 'AVAILABLE' },
        { id: 'seat-2', seatNumber: 2, status: 'AVAILABLE' },
      ];

      mockSeatRepository.findById
        .mockResolvedValueOnce(seats[0])
        .mockResolvedValueOnce(seats[1]);

      const result = await auditService.fetchDenormalizedData({
        seatIds: ['seat-1', 'seat-2'],
      });

      expect(result.seats).toHaveLength(2);
    });

    it('should handle errors gracefully', async () => {
      mockUserRepository.findById.mockRejectedValue(new Error('Database error'));

      const result = await auditService.fetchDenormalizedData({ userId: 'user-123' });

      expect(result.user).toBeUndefined();
    });

    it('should handle null repository', async () => {
      const serviceWithoutRepos = new AuditService(mockQueueService);

      const result = await serviceWithoutRepos.fetchDenormalizedData({ userId: 'user-123' });

      expect(result).toEqual({});
    });
  });

  describe('log', () => {
    it('should enqueue audit log with success outcome', async () => {
      const logData = {
        operationType: OperationType.BOOK,
        bookingId: 'booking-123',
        userId: 'user-123',
        showId: 'show-123',
        outcome: AuditOutcome.SUCCESS,
      };

      await auditService.log(logData);

      expect(mockQueueService.enqueueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: OperationType.BOOK,
          outcome: AuditOutcome.SUCCESS,
        }),
        expect.any(String)
      );
    });

    it('should enqueue without eventId (eventId is resolved in worker)', async () => {
      const logData = {
        operationType: OperationType.BOOK,
        showId: 'show-123',
        outcome: AuditOutcome.SUCCESS,
      };

      await auditService.log(logData);

      expect(mockQueueService.enqueueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: OperationType.BOOK,
          showId: 'show-123',
          outcome: AuditOutcome.SUCCESS,
        }),
        expect.any(String)
      );
    });

    it('should handle seatIds from metadata', async () => {
      const logData = {
        operationType: OperationType.LOCK,
        bookingId: 'booking-123',
        metadata: {
          seatIds: ['seat-1', 'seat-2'],
        },
        outcome: AuditOutcome.SUCCESS,
      };

      await auditService.log(logData);

      expect(mockQueueService.enqueueAuditLog).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockQueueService.enqueueAuditLog.mockRejectedValue(new Error('Queue error'));

      const logData = {
        operationType: OperationType.BOOK,
        outcome: AuditOutcome.SUCCESS,
      };

      await expect(auditService.log(logData)).resolves.not.toThrow();
    });
  });

  describe('logSuccess', () => {
    it('should log with SUCCESS outcome', async () => {
      const logData = {
        operationType: OperationType.BOOK,
        bookingId: 'booking-123',
      };

      await auditService.logSuccess(logData);

      expect(mockQueueService.enqueueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: AuditOutcome.SUCCESS,
        }),
        expect.any(String)
      );
    });
  });

  describe('logFailure', () => {
    it('should log with FAILURE outcome', async () => {
      const logData = {
        operationType: OperationType.BOOK,
        bookingId: 'booking-123',
        reason: 'Error message',
      };

      await auditService.logFailure(logData);

      expect(mockQueueService.enqueueAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: AuditOutcome.FAILURE,
        }),
        expect.any(String)
      );
    });
  });

  describe('getLogs', () => {
    it('should get logs with filters', async () => {
      const mockLogs = [
        { id: 'log-1', operationType: OperationType.BOOK },
        { id: 'log-2', operationType: OperationType.CANCEL },
      ];

      mockExec.mockResolvedValue(mockLogs);

      const filters = {
        showId: 'show-123',
        userId: 'user-123',
        operationType: OperationType.BOOK,
        outcome: AuditOutcome.SUCCESS,
        limit: 50,
      };

      const result = await auditService.getLogs(filters);

      expect(result).toEqual(mockLogs);
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          showId: 'show-123',
          userId: 'user-123',
          operationType: OperationType.BOOK,
          outcome: AuditOutcome.SUCCESS,
        })
      );
    });

    it('should handle date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockExec.mockResolvedValue([]);

      await auditService.getLogs({ startDate, endDate });

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        })
      );
    });

    it('should use default limit when not provided', async () => {
      mockExec.mockResolvedValue([]);

      await auditService.getLogs({});

      expect(mockLimit).toHaveBeenCalledWith(100);
    });
  });

  describe('getLogsCount', () => {
    it('should get count with filters', async () => {
      const mockCountExec = jest.fn().mockResolvedValue(10);
      mockAuditLog.countDocuments.mockReturnValueOnce({ exec: mockCountExec });

      const filters = {
        showId: 'show-123',
        operationType: OperationType.BOOK,
      };

      const result = await auditService.getLogsCount(filters);

      expect(result).toBe(10);
      expect(mockAuditLog.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          showId: 'show-123',
          operationType: OperationType.BOOK,
        })
      );
    });

    it('should handle date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockCountExec = jest.fn().mockResolvedValue(5);
      mockAuditLog.countDocuments.mockReturnValueOnce({ exec: mockCountExec });

      const result = await auditService.getLogsCount({ startDate, endDate });

      expect(result).toBe(5);
    });
  });
});

