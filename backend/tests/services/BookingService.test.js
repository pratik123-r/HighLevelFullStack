import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Ultra-minimal mocks - only what's absolutely necessary
const mockPrisma = {
  booking: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.unstable_mockModule('@prisma/client', async () => {
  const actual = await import('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn(() => mockPrisma),
    Prisma: { join: jest.fn(), sql: jest.fn() },
  };
});

jest.unstable_mockModule('../../src/config/database.js', () => ({
  prisma: mockPrisma,
  connectMongoDB: jest.fn(),
  disconnectDatabases: jest.fn(),
}));

const { BookingService } = await import('../../src/services/BookingService.js');
const { BookingStatus } = await import('@prisma/client');

const mockSeatLockService = {
  lockSeats: jest.fn(),
  unlockByBookingId: jest.fn().mockResolvedValue(1),
  hasLocksForBooking: jest.fn().mockResolvedValue(false),
};

jest.unstable_mockModule('../../src/services/SeatLockService.js', () => ({
  SeatLockService: jest.fn(() => mockSeatLockService),
}));

jest.unstable_mockModule('crypto', () => ({
  randomUUID: jest.fn(() => 'uuid'),
}));

describe('BookingService - Essential Tests Only', () => {
  let bookingService;
  let mockBookingRepository;
  let mockSeatRepository;
  let mockShowRepository;
  let mockUserRepository;
  let mockAuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBookingRepository = { findById: jest.fn() };
    mockSeatRepository = { findByIds: jest.fn() };
    mockShowRepository = { findById: jest.fn() };
    mockUserRepository = { findById: jest.fn() };
    mockAuditService = {
      logSuccess: jest.fn().mockResolvedValue(undefined),
      logFailure: jest.fn().mockResolvedValue(undefined),
    };
    bookingService = new BookingService(
      mockBookingRepository,
      mockSeatRepository,
      mockShowRepository,
      mockUserRepository,
      mockAuditService,
      mockSeatLockService
    );
  });

  describe('lockSeats validation', () => {
    it('should validate seatId/seatIds required', async () => {
      await expect(bookingService.lockSeats({ userId: 'user-123' })).rejects.toThrow(
        'Either seatId or seatIds array is required'
      );
    });

    it('should validate empty seatIds', async () => {
      await expect(bookingService.lockSeats({ seatIds: [], userId: 'user-123' })).rejects.toThrow(
        'At least one seat ID is required'
      );
    });

    it('should validate MAX_SEATS limit', async () => {
      await expect(bookingService.lockSeats({ seatIds: Array(6).fill('seat'), userId: 'user-123' })).rejects.toThrow(
        'Cannot lock more than 5 seats at once'
      );
    });

    it('should validate duplicate seats', async () => {
      await expect(bookingService.lockSeats({ seatIds: ['seat-1', 'seat-1'], userId: 'user-123' })).rejects.toThrow(
        'Duplicate seat IDs are not allowed'
      );
    });
  });

  describe('cancelBooking validation', () => {
    it('should validate booking exists', async () => {
      mockBookingRepository.findById.mockResolvedValue(null);
      await expect(bookingService.cancelBooking('booking-123', 'user-123')).rejects.toThrow('Booking not found');
    });
  });

  describe('getBookingById', () => {
    it('should return booking when found', async () => {
      const booking = { id: 'booking-123' };
      mockBookingRepository.findById.mockResolvedValue(booking);
      expect(await bookingService.getBookingById('booking-123')).toEqual(booking);
    });

    it('should throw when booking not found', async () => {
      mockBookingRepository.findById.mockResolvedValue(null);
      await expect(bookingService.getBookingById('invalid')).rejects.toThrow('Booking not found');
    });
  });
});
