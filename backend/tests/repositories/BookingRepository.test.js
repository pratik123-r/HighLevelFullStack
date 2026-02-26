import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPrisma = {
  booking: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  $disconnect: jest.fn().mockResolvedValue(undefined),
};

// Mock PrismaClient before importing anything that uses it
jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {
    join: jest.fn((items, separator) => items.join(separator)),
    sql: jest.fn((strings, ...values) => ({
      strings,
      values,
    })),
  },
}));

jest.unstable_mockModule('../../src/config/database.js', () => ({
  prisma: mockPrisma,
  connectMongoDB: jest.fn(),
  disconnectDatabases: jest.fn(),
}));

const { BookingRepository } = await import('../../src/repositories/BookingRepository.js');

describe('BookingRepository', () => {
  let bookingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    bookingRepository = new BookingRepository();
  });

  describe('create', () => {
    it('should create booking with all includes', async () => {
      const data = {
        userId: 'user-123',
        showId: 'show-123',
        status: 'PENDING',
      };

      const createdBooking = {
        id: 'booking-123',
        ...data,
        user: { id: 'user-123' },
        show: { id: 'show-123', event: { venue: {} } },
        seats: [{ id: 'seat-123', seatNumber: 1 }],
      };

      mockPrisma.booking.create.mockResolvedValue(createdBooking);

      const result = await bookingRepository.create(data);

      expect(mockPrisma.booking.create).toHaveBeenCalledWith({
        data,
        include: {
          user: true,
          show: { include: { event: { include: { venue: true } } } },
          seats: { orderBy: { seatNumber: 'asc' } },
        },
      });
      expect(result).toEqual(createdBooking);
    });
  });

  describe('findById', () => {
    it('should find booking by id with includes', async () => {
      const id = 'booking-123';
      const booking = {
        id,
        userId: 'user-123',
        user: { id: 'user-123' },
        show: { id: 'show-123' },
        seats: [{ id: 'seat-123', seatNumber: 1 }],
      };

      mockPrisma.booking.findUnique.mockResolvedValue(booking);

      const result = await bookingRepository.findById(id);

      expect(mockPrisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id },
        include: {
          user: true,
          show: { include: { event: { include: { venue: true } } } },
          seats: { orderBy: { seatNumber: 'asc' } },
        },
      });
      expect(result).toEqual(booking);
    });

    it('should return null when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      const result = await bookingRepository.findById('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find bookings by user id', async () => {
      const userId = 'user-123';
      const bookings = [
        { id: 'booking-1', userId },
        { id: 'booking-2', userId },
      ];

      mockPrisma.booking.findMany.mockResolvedValue(bookings);

      const result = await bookingRepository.findByUserId(userId);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          show: { include: { event: { include: { venue: true } } } },
          seats: { orderBy: { seatNumber: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(bookings);
    });
  });

  describe('findByUserIdPaginated', () => {
    it('should find bookings by user id with pagination', async () => {
      const userId = 'user-123';
      const skip = 0;
      const take = 10;
      const bookings = [{ id: 'booking-1' }];
      const total = 1;

      mockPrisma.booking.findMany.mockResolvedValue(bookings);
      mockPrisma.booking.count.mockResolvedValue(total);

      const result = await bookingRepository.findByUserIdPaginated(userId, skip, take);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith({
        where: { userId },
        skip,
        take,
        include: {
          show: { include: { event: { include: { venue: true } } } },
          seats: { orderBy: { seatNumber: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.booking.count).toHaveBeenCalledWith({ where: { userId } });
      expect(result).toEqual({ data: bookings, total });
    });

    it('should use default pagination values', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.booking.count.mockResolvedValue(0);

      await bookingRepository.findByUserIdPaginated('user-123');

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        })
      );
    });
  });

  describe('findByShowId', () => {
    it('should find bookings by show id', async () => {
      const showId = 'show-123';
      const bookings = [{ id: 'booking-1', showId }];

      mockPrisma.booking.findMany.mockResolvedValue(bookings);

      const result = await bookingRepository.findByShowId(showId);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith({
        where: { showId },
        include: { user: true, seats: { orderBy: { seatNumber: 'asc' } } },
      });
      expect(result).toEqual(bookings);
    });
  });

  describe('updateStatus', () => {
    it('should update booking status', async () => {
      const id = 'booking-123';
      const status = 'CONFIRMED';
      const updatedBooking = {
        id,
        status,
        user: { id: 'user-123' },
        show: { id: 'show-123' },
        seats: [{ id: 'seat-123', seatNumber: 1 }],
      };

      mockPrisma.booking.update.mockResolvedValue(updatedBooking);

      const result = await bookingRepository.updateStatus(id, status);

      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id },
        data: { status },
        include: {
          user: true,
          show: { include: { event: { include: { venue: true } } } },
          seats: { orderBy: { seatNumber: 'asc' } },
        },
      });
      expect(result).toEqual(updatedBooking);
    });
  });
});

