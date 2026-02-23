import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ShowService } from '../../src/services/ShowService.js';
import { ShowStatus } from '@prisma/client';

describe('ShowService', () => {
  let showService;
  let mockShowRepository;
  let mockEventRepository;
  let mockVenueRepository;
  let mockQueueService;
  let mockAdminRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    mockShowRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByStatusPaginated: jest.fn(),
      findAllPaginated: jest.fn(),
    };

    mockEventRepository = {
      findById: jest.fn(),
    };

    mockVenueRepository = {
      findById: jest.fn(),
    };

    mockQueueService = {
      enqueueSeatGeneration: jest.fn().mockResolvedValue(undefined),
    };

    mockAdminRepository = {
      findById: jest.fn(),
    };

    showService = new ShowService(
      mockShowRepository,
      mockEventRepository,
      mockVenueRepository,
      mockQueueService,
      mockAdminRepository
    );
  });

  describe('createShow', () => {
    it('should create show successfully', async () => {
      const adminId = 'admin-123';
      const eventId = 'event-123';
      const totalSeats = 100;

      const admin = {
        id: adminId,
        name: 'Admin User',
        email: 'admin@example.com',
      };

      const event = {
        id: eventId,
        name: 'Test Event',
      };

      const createdShow = {
        id: 'show-123',
        eventId,
        adminId,
        totalSeats,
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
      };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockEventRepository.findById.mockResolvedValue(event);
      mockShowRepository.create.mockResolvedValue(createdShow);

      const result = await showService.createShow({
        eventId,
        adminId,
        totalSeats,
      });

      expect(result).toEqual(createdShow);
      expect(mockAdminRepository.findById).toHaveBeenCalledWith(adminId);
      expect(mockEventRepository.findById).toHaveBeenCalledWith(eventId);
      expect(mockShowRepository.create).toHaveBeenCalledWith({
        event: { connect: { id: eventId } },
        createdByAdmin: { connect: { id: adminId } },
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
        totalSeats,
      });
      expect(mockQueueService.enqueueSeatGeneration).toHaveBeenCalledWith(createdShow.id);
    });

    it('should throw error when adminId is missing', async () => {
      await expect(
        showService.createShow({
          eventId: 'event-123',
          totalSeats: 100,
        })
      ).rejects.toThrow('Admin ID is required to create a show');
    });

    it('should throw error when admin not found', async () => {
      mockAdminRepository.findById.mockResolvedValue(null);

      await expect(
        showService.createShow({
          eventId: 'event-123',
          adminId: 'invalid-admin',
          totalSeats: 100,
        })
      ).rejects.toThrow('Admin not found');
    });

    it('should throw error when event not found', async () => {
      const admin = { id: 'admin-123' };
      mockAdminRepository.findById.mockResolvedValue(admin);
      mockEventRepository.findById.mockResolvedValue(null);

      await expect(
        showService.createShow({
          eventId: 'invalid-event',
          adminId: 'admin-123',
          totalSeats: 100,
        })
      ).rejects.toThrow('Event not found');
    });

    it('should convert totalSeats to number', async () => {
      const admin = { id: 'admin-123' };
      const event = { id: 'event-123' };
      const createdShow = {
        id: 'show-123',
        totalSeats: 100,
        status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
      };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockEventRepository.findById.mockResolvedValue(event);
      mockShowRepository.create.mockResolvedValue(createdShow);

      await showService.createShow({
        eventId: 'event-123',
        adminId: 'admin-123',
        totalSeats: '100',
      });

      expect(mockShowRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalSeats: 100,
        })
      );
    });
  });

  describe('getShowById', () => {
    it('should get show by id', async () => {
      const showId = 'show-123';
      const show = {
        id: showId,
        eventId: 'event-123',
        status: ShowStatus.AVAILABLE,
        event: { id: 'event-123', name: 'Test Event' },
        createdByAdmin: { id: 'admin-123', name: 'Admin' },
      };

      mockShowRepository.findById.mockResolvedValue(show);

      const result = await showService.getShowById(showId);

      expect(result).toEqual(show);
      expect(mockShowRepository.findById).toHaveBeenCalledWith(showId);
    });

    it('should throw error when show not found', async () => {
      mockShowRepository.findById.mockResolvedValue(null);

      await expect(showService.getShowById('invalid-id')).rejects.toThrow('Show not found');
    });
  });

  describe('getAvailableShowsPaginated', () => {
    it('should get available shows with default status', async () => {
      const shows = [
        { id: 'show-1', status: ShowStatus.AVAILABLE, event: {} },
        { id: 'show-2', status: ShowStatus.AVAILABLE, event: {} },
      ];

      mockShowRepository.findByStatusPaginated.mockResolvedValue({
        data: shows,
        total: 2,
      });

      const result = await showService.getAvailableShowsPaginated(1, 10);

      expect(result.data).toEqual(shows);
      expect(result.total).toBe(2);
      expect(mockShowRepository.findByStatusPaginated).toHaveBeenCalledWith(
        ShowStatus.AVAILABLE,
        0,
        10
      );
    });

    it('should get shows with custom status filter', async () => {
      mockShowRepository.findByStatusPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      // Use CLOSED as it's a valid ShowStatus enum value
      await showService.getAvailableShowsPaginated(1, 10, ShowStatus.CLOSED);

      expect(mockShowRepository.findByStatusPaginated).toHaveBeenCalledWith(
        ShowStatus.CLOSED, // The implementation validates and uses the provided status
        0,
        10
      );
    });

    it('should use default status when invalid status provided', async () => {
      mockShowRepository.findByStatusPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await showService.getAvailableShowsPaginated(1, 10, 'INVALID_STATUS');

      expect(mockShowRepository.findByStatusPaginated).toHaveBeenCalledWith(
        ShowStatus.AVAILABLE,
        0,
        10
      );
    });
  });

  describe('getAllShowsPaginated', () => {
    it('should get all shows without status filter', async () => {
      const shows = [
        { id: 'show-1', status: ShowStatus.AVAILABLE, event: {} },
        { id: 'show-2', status: ShowStatus.CLOSED, event: {} },
      ];

      mockShowRepository.findAllPaginated.mockResolvedValue({
        data: shows,
        total: 2,
      });

      const result = await showService.getAllShowsPaginated(1, 10);

      expect(result.data).toEqual(shows);
      expect(result.total).toBe(2);
      expect(mockShowRepository.findAllPaginated).toHaveBeenCalledWith(0, 10, null);
    });

    it('should get all shows with status filter', async () => {
      mockShowRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await showService.getAllShowsPaginated(1, 10, ShowStatus.AVAILABLE);

      expect(mockShowRepository.findAllPaginated).toHaveBeenCalledWith(
        0,
        10,
        ShowStatus.AVAILABLE
      );
    });

    it('should use null status when invalid status provided', async () => {
      mockShowRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await showService.getAllShowsPaginated(1, 10, 'INVALID_STATUS');

      expect(mockShowRepository.findAllPaginated).toHaveBeenCalledWith(0, 10, null);
    });
  });
});

