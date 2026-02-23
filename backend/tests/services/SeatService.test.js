import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SeatService } from '../../src/services/SeatService.js';

describe('SeatService', () => {
  let seatService;
  let mockSeatRepository;
  let mockShowRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSeatRepository = {
      findByShowId: jest.fn(),
      findById: jest.fn(),
    };

    mockShowRepository = {
      findById: jest.fn(),
    };

    seatService = new SeatService(mockSeatRepository, mockShowRepository);
  });

  describe('isSeatLocked', () => {
    it('should return false when lockedTill is null', () => {
      const seat = { id: 'seat-1', lockedTill: null };

      const result = seatService.isSeatLocked(seat);

      expect(result).toBe(false);
    });

    it('should return false when lockedTill is undefined', () => {
      const seat = { id: 'seat-1' };

      const result = seatService.isSeatLocked(seat);

      expect(result).toBe(false);
    });

    it('should return false when lockedTill is in the past', () => {
      const pastDate = new Date(Date.now() - 10000);
      const seat = { id: 'seat-1', lockedTill: pastDate };

      const result = seatService.isSeatLocked(seat);

      expect(result).toBe(false);
    });

    it('should return true when lockedTill is in the future', () => {
      const futureDate = new Date(Date.now() + 60000);
      const seat = { id: 'seat-1', lockedTill: futureDate };

      const result = seatService.isSeatLocked(seat);

      expect(result).toBe(true);
    });

    it('should return false when lockedTill is exactly now', () => {
      const now = new Date();
      const seat = { id: 'seat-1', lockedTill: now };

      const result = seatService.isSeatLocked(seat);

      expect(result).toBe(false);
    });
  });

  describe('enrichSeatsWithLockStatus', () => {
    it('should add isLocked field to seats', () => {
      const seats = [
        { id: 'seat-1', lockedTill: new Date(Date.now() + 60000) },
        { id: 'seat-2', lockedTill: null },
        { id: 'seat-3', lockedTill: new Date(Date.now() - 10000) },
      ];

      const result = seatService.enrichSeatsWithLockStatus(seats);

      expect(result).toHaveLength(3);
      expect(result[0].isLocked).toBe(true);
      expect(result[1].isLocked).toBe(false);
      expect(result[2].isLocked).toBe(false);
    });

    it('should handle empty array', () => {
      const result = seatService.enrichSeatsWithLockStatus([]);

      expect(result).toEqual([]);
    });

    it('should create deep copy of seats', () => {
      const seats = [{ id: 'seat-1', lockedTill: new Date(Date.now() + 60000) }];

      const result = seatService.enrichSeatsWithLockStatus(seats);

      expect(result[0]).not.toBe(seats[0]);
      expect(result[0].id).toBe(seats[0].id);
    });
  });

  describe('getSeatsByShowPaginated', () => {
    const showId = 'show-123';

    it('should get seats for show successfully', async () => {
      const show = { id: showId, status: 'AVAILABLE' };
      const seats = [
        { id: 'seat-1', showId, seatNumber: 1, lockedTill: new Date(Date.now() + 60000) },
        { id: 'seat-2', showId, seatNumber: 2, lockedTill: null },
      ];

      mockShowRepository.findById.mockResolvedValue(show);
      mockSeatRepository.findByShowId.mockResolvedValue(seats);

      const result = await seatService.getSeatsByShowPaginated(showId);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0]).toHaveProperty('isLocked');
      expect(mockShowRepository.findById).toHaveBeenCalledWith(showId);
      expect(mockSeatRepository.findByShowId).toHaveBeenCalledWith(showId);
    });

    it('should throw error when show not found', async () => {
      mockShowRepository.findById.mockResolvedValue(null);

      await expect(seatService.getSeatsByShowPaginated(showId)).rejects.toThrow(
        'Show not found'
      );
    });

    it('should ignore status parameter', async () => {
      const show = { id: showId };
      const seats = [];

      mockShowRepository.findById.mockResolvedValue(show);
      mockSeatRepository.findByShowId.mockResolvedValue(seats);

      await seatService.getSeatsByShowPaginated(showId, 'BOOKED', 1, 10);

      expect(mockSeatRepository.findByShowId).toHaveBeenCalledWith(showId);
    });

    it('should return enriched seats with lock status', async () => {
      const show = { id: showId };
      const seats = [
        { id: 'seat-1', lockedTill: new Date(Date.now() + 60000) },
        { id: 'seat-2', lockedTill: null },
      ];

      mockShowRepository.findById.mockResolvedValue(show);
      mockSeatRepository.findByShowId.mockResolvedValue(seats);

      const result = await seatService.getSeatsByShowPaginated(showId);

      expect(result.data[0].isLocked).toBe(true);
      expect(result.data[1].isLocked).toBe(false);
    });

    it('should return correct pagination info', async () => {
      const show = { id: showId };
      const seats = Array.from({ length: 5 }, (_, i) => ({
        id: `seat-${i}`,
        seatNumber: i + 1,
      }));

      mockShowRepository.findById.mockResolvedValue(show);
      mockSeatRepository.findByShowId.mockResolvedValue(seats);

      const result = await seatService.getSeatsByShowPaginated(showId, null, 1, 10);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.total).toBe(5);
    });
  });
});

