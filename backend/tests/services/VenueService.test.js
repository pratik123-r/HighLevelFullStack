import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { VenueService } from '../../src/services/VenueService.js';

describe('VenueService', () => {
  let venueService;
  let mockVenueRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    mockVenueRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAllPaginated: jest.fn(),
    };

    venueService = new VenueService(mockVenueRepository);
  });

  describe('createVenue', () => {
    it('should create venue with number totalSeatCount', async () => {
      const venueData = {
        name: 'Test Venue',
        totalSeatCount: 100,
      };

      const createdVenue = {
        id: 'venue-123',
        ...venueData,
      };

      mockVenueRepository.create.mockResolvedValue(createdVenue);

      const result = await venueService.createVenue(venueData);

      expect(result).toEqual(createdVenue);
      expect(mockVenueRepository.create).toHaveBeenCalledWith({
        name: venueData.name,
        totalSeatCount: 100,
      });
    });

    it('should create venue with string totalSeatCount', async () => {
      const venueData = {
        name: 'Test Venue',
        totalSeatCount: '100',
      };

      const createdVenue = {
        id: 'venue-123',
        name: 'Test Venue',
        totalSeatCount: 100,
      };

      mockVenueRepository.create.mockResolvedValue(createdVenue);

      const result = await venueService.createVenue(venueData);

      expect(result).toEqual(createdVenue);
      expect(mockVenueRepository.create).toHaveBeenCalledWith({
        name: venueData.name,
        totalSeatCount: 100,
      });
    });

    it('should throw error when totalSeatCount is not a positive number', async () => {
      await expect(
        venueService.createVenue({
          name: 'Test Venue',
          totalSeatCount: 0,
        })
      ).rejects.toThrow('Total seat count must be a positive number');
    });

    it('should throw error when totalSeatCount is negative', async () => {
      await expect(
        venueService.createVenue({
          name: 'Test Venue',
          totalSeatCount: -10,
        })
      ).rejects.toThrow('Total seat count must be a positive number');
    });

    it('should throw error when totalSeatCount is NaN', async () => {
      await expect(
        venueService.createVenue({
          name: 'Test Venue',
          totalSeatCount: 'invalid',
        })
      ).rejects.toThrow('Total seat count must be a positive number');
    });

    it('should throw error when totalSeatCount is invalid string', async () => {
      await expect(
        venueService.createVenue({
          name: 'Test Venue',
          totalSeatCount: 'abc',
        })
      ).rejects.toThrow('Total seat count must be a positive number');
    });
  });

  describe('getVenueById', () => {
    it('should get venue by id', async () => {
      const venueId = 'venue-123';
      const venue = {
        id: venueId,
        name: 'Test Venue',
        totalSeatCount: 100,
      };

      mockVenueRepository.findById.mockResolvedValue(venue);

      const result = await venueService.getVenueById(venueId);

      expect(result).toEqual(venue);
      expect(mockVenueRepository.findById).toHaveBeenCalledWith(venueId);
    });

    it('should throw error when venue not found', async () => {
      mockVenueRepository.findById.mockResolvedValue(null);

      await expect(venueService.getVenueById('invalid-id')).rejects.toThrow('Venue not found');
    });
  });

  describe('getAllVenuesPaginated', () => {
    it('should get paginated venues', async () => {
      const venues = [
        { id: 'venue-1', name: 'Venue 1', totalSeatCount: 100 },
        { id: 'venue-2', name: 'Venue 2', totalSeatCount: 200 },
      ];

      mockVenueRepository.findAllPaginated.mockResolvedValue({
        data: venues,
        total: 2,
      });

      const result = await venueService.getAllVenuesPaginated(1, 10);

      expect(result.data).toEqual(venues);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(mockVenueRepository.findAllPaginated).toHaveBeenCalledWith(0, 10);
    });

    it('should calculate skip correctly', async () => {
      mockVenueRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await venueService.getAllVenuesPaginated(2, 10);

      expect(mockVenueRepository.findAllPaginated).toHaveBeenCalledWith(10, 10);
    });

    it('should use default pagination values', async () => {
      mockVenueRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await venueService.getAllVenuesPaginated();

      expect(mockVenueRepository.findAllPaginated).toHaveBeenCalledWith(0, 10);
    });
  });
});

