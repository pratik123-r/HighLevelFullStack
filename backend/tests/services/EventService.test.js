import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EventService } from '../../src/services/EventService.js';

describe('EventService', () => {
  let eventService;
  let mockEventRepository;
  let mockVenueRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEventRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAllPaginated: jest.fn(),
    };

    mockVenueRepository = {
      findById: jest.fn(),
    };

    eventService = new EventService(mockEventRepository, mockVenueRepository);
  });

  describe('createEvent', () => {
    it('should create event successfully', async () => {
      const venueId = 'venue-123';
      const venue = {
        id: venueId,
        name: 'Test Venue',
        totalSeatCount: 100,
      };

      const eventData = {
        name: 'Test Event',
        venueId,
      };

      const createdEvent = {
        id: 'event-123',
        name: 'Test Event',
        venue,
      };

      mockVenueRepository.findById.mockResolvedValue(venue);
      mockEventRepository.create.mockResolvedValue(createdEvent);

      const result = await eventService.createEvent(eventData);

      expect(result).toEqual(createdEvent);
      expect(mockVenueRepository.findById).toHaveBeenCalledWith(venueId);
      expect(mockEventRepository.create).toHaveBeenCalledWith({
        name: eventData.name,
        venue: { connect: { id: venueId } },
      });
    });

    it('should throw error when venue not found', async () => {
      mockVenueRepository.findById.mockResolvedValue(null);

      await expect(
        eventService.createEvent({
          name: 'Test Event',
          venueId: 'invalid-venue',
        })
      ).rejects.toThrow('Venue not found');
    });
  });

  describe('getEventById', () => {
    it('should get event by id', async () => {
      const eventId = 'event-123';
      const event = {
        id: eventId,
        name: 'Test Event',
        venue: {
          id: 'venue-123',
          name: 'Test Venue',
        },
      };

      mockEventRepository.findById.mockResolvedValue(event);

      const result = await eventService.getEventById(eventId);

      expect(result).toEqual(event);
      expect(mockEventRepository.findById).toHaveBeenCalledWith(eventId);
    });

    it('should throw error when event not found', async () => {
      mockEventRepository.findById.mockResolvedValue(null);

      await expect(eventService.getEventById('invalid-id')).rejects.toThrow('Event not found');
    });
  });

  describe('getAllEventsPaginated', () => {
    it('should get paginated events', async () => {
      const events = [
        {
          id: 'event-1',
          name: 'Event 1',
          venue: { id: 'venue-1', name: 'Venue 1' },
        },
        {
          id: 'event-2',
          name: 'Event 2',
          venue: { id: 'venue-2', name: 'Venue 2' },
        },
      ];

      mockEventRepository.findAllPaginated.mockResolvedValue({
        data: events,
        total: 2,
      });

      const result = await eventService.getAllEventsPaginated(1, 10);

      expect(result.data).toEqual(events);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(mockEventRepository.findAllPaginated).toHaveBeenCalledWith(0, 10);
    });

    it('should calculate skip correctly', async () => {
      mockEventRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await eventService.getAllEventsPaginated(2, 10);

      expect(mockEventRepository.findAllPaginated).toHaveBeenCalledWith(10, 10);
    });

    it('should use default pagination values', async () => {
      mockEventRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await eventService.getAllEventsPaginated();

      expect(mockEventRepository.findAllPaginated).toHaveBeenCalledWith(0, 10);
    });
  });
});

