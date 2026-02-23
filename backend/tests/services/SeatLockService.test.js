import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockRedis = {
  script: jest.fn(),
  evalsha: jest.fn(),
  eval: jest.fn(),
  scard: jest.fn(),
  on: jest.fn(),
};

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

const { SeatLockService } = await import('../../src/services/SeatLockService.js');

describe('SeatLockService', () => {
  let seatLockService;

  beforeEach(() => {
    jest.clearAllMocks();
    seatLockService = new SeatLockService();
    // Reset initialization promise for each test to ensure clean state
    seatLockService.initializationPromise = null;
  });

  describe('ensureInitialized', () => {
    it('should load scripts on first call', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');

      await seatLockService.ensureInitialized();

      expect(mockRedis.script).toHaveBeenCalledWith('LOAD', expect.stringContaining('local'));
      expect(seatLockService.lockSeatsScript).toBe('script-sha-123');
      expect(seatLockService.unlockByBookingScript).toBe('script-sha-123');
    });


    it('should handle script loading errors', async () => {
      mockRedis.script.mockRejectedValue(new Error('Redis error'));

      await seatLockService.ensureInitialized();

      expect(seatLockService.lockSeatsScript).toBeNull();
    });
  });

  describe('lockSeats', () => {
    const userId = 'user-123';
    const bookingId = 'booking-123';
    const seatIds = ['seat-1', 'seat-2'];

    beforeEach(async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      await seatLockService.ensureInitialized();
    });

    it('should return false when seatIds is empty', async () => {
      const result = await seatLockService.lockSeats([], userId, bookingId);

      expect(result).toBe(false);
      expect(mockRedis.evalsha).not.toHaveBeenCalled();
    });

    it('should throw error when userId is missing', async () => {
      await expect(seatLockService.lockSeats(seatIds, null, bookingId)).rejects.toThrow(
        'UserId and bookingId are required'
      );
    });

    it('should throw error when bookingId is missing', async () => {
      await expect(seatLockService.lockSeats(seatIds, userId, null)).rejects.toThrow(
        'UserId and bookingId are required'
      );
    });

    it('should lock seats successfully using evalsha', async () => {
      mockRedis.evalsha.mockResolvedValue(2);

      const result = await seatLockService.lockSeats(seatIds, userId, bookingId, 300);

      expect(result).toBe(true);
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        'script-sha-123',
        0,
        userId,
        bookingId,
        '300',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        ...seatIds
      );
    });

    it('should lock seats using eval when script sha not available', async () => {
      seatLockService.lockSeatsScript = null;
      mockRedis.eval.mockResolvedValue(2);

      const result = await seatLockService.lockSeats(seatIds, userId, bookingId);

      expect(result).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalled();
      expect(mockRedis.evalsha).not.toHaveBeenCalled();
    });

    it('should return false when not all seats locked', async () => {
      mockRedis.evalsha.mockResolvedValue(1); // Only 1 seat locked, but 2 requested

      const result = await seatLockService.lockSeats(seatIds, userId, bookingId);

      expect(result).toBe(false);
    });

    it('should return false on Redis error', async () => {
      mockRedis.evalsha.mockRejectedValue(new Error('Redis error'));

      const result = await seatLockService.lockSeats(seatIds, userId, bookingId);

      expect(result).toBe(false);
    });

    it('should use default ttl when not provided', async () => {
      mockRedis.evalsha.mockResolvedValue(2);

      await seatLockService.lockSeats(seatIds, userId, bookingId);

      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.anything(),
        0,
        userId,
        bookingId,
        '300', // Default 5 minutes
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        ...seatIds
      );
    });
  });

  describe('unlockByBookingId', () => {
    const bookingId = 'booking-123';

    beforeEach(async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      await seatLockService.ensureInitialized();
    });

    it('should return 0 when bookingId is empty', async () => {
      const result = await seatLockService.unlockByBookingId('');

      expect(result).toBe(0);
      expect(mockRedis.evalsha).not.toHaveBeenCalled();
    });

    it('should return 0 when bookingId is null', async () => {
      const result = await seatLockService.unlockByBookingId(null);

      expect(result).toBe(0);
    });

    it('should unlock seats successfully using evalsha', async () => {
      mockRedis.evalsha.mockResolvedValue(2);

      const result = await seatLockService.unlockByBookingId(bookingId);

      expect(result).toBe(2);
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        'script-sha-123',
        0,
        bookingId,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should unlock seats using eval when script sha not available', async () => {
      seatLockService.unlockByBookingScript = null;
      mockRedis.eval.mockResolvedValue(2);

      const result = await seatLockService.unlockByBookingId(bookingId);

      expect(result).toBe(2);
      expect(mockRedis.eval).toHaveBeenCalled();
      expect(mockRedis.evalsha).not.toHaveBeenCalled();
    });

    it('should return 0 on Redis error', async () => {
      mockRedis.evalsha.mockRejectedValue(new Error('Redis error'));

      const result = await seatLockService.unlockByBookingId(bookingId);

      expect(result).toBe(0);
    });
  });

  describe('hasLocksForBooking', () => {
    const userId = 'user-123';
    const bookingId = 'booking-123';

    it('should return false when userId is missing', async () => {
      const result = await seatLockService.hasLocksForBooking(null, bookingId);

      expect(result).toBe(false);
    });

    it('should return false when bookingId is missing', async () => {
      const result = await seatLockService.hasLocksForBooking(userId, null);

      expect(result).toBe(false);
    });

    it('should return true when locks exist', async () => {
      mockRedis.scard.mockResolvedValue(2);

      const result = await seatLockService.hasLocksForBooking(userId, bookingId);

      expect(result).toBe(true);
      expect(mockRedis.scard).toHaveBeenCalledWith(
        expect.stringContaining(`${userId}:${bookingId}`)
      );
    });

    it('should return false when no locks exist', async () => {
      mockRedis.scard.mockResolvedValue(0);

      const result = await seatLockService.hasLocksForBooking(userId, bookingId);

      expect(result).toBe(false);
    });

    it('should return false on Redis error', async () => {
      mockRedis.scard.mockRejectedValue(new Error('Redis error'));

      const result = await seatLockService.hasLocksForBooking(userId, bookingId);

      expect(result).toBe(false);
    });
  });
});

