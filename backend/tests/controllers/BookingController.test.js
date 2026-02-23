import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BookingController } from '../../src/controllers/BookingController.js';
import { BookingStatus } from '@prisma/client';

describe('BookingController', () => {
  let bookingController;
  let mockBookingService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBookingService = {
      lockSeats: jest.fn(),
      confirmBooking: jest.fn(),
      cancelBooking: jest.fn(),
      getUserBookingsPaginated: jest.fn(),
      getBookingById: jest.fn(),
      getAllBookingsPaginated: jest.fn(),
    };

    bookingController = new BookingController(mockBookingService);

    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { id: 'user-123' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('lockSeats', () => {
    it('should lock seats successfully with seatIds', async () => {
      const seatIds = ['seat-1', 'seat-2'];
      mockReq.body = { seatIds };
      mockBookingService.lockSeats.mockResolvedValue({
        seats: [{ id: 'seat-1' }, { id: 'seat-2' }],
        booking: { id: 'booking-123' },
        bookingId: 'booking-123',
        count: 2,
      });

      await bookingController.lockSeats(mockReq, mockRes);

      expect(mockBookingService.lockSeats).toHaveBeenCalledWith({
        seatIds,
        seatId: undefined,
        userId: 'user-123',
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should lock seats successfully with seatId', async () => {
      mockReq.body = { seatId: 'seat-1' };
      mockBookingService.lockSeats.mockResolvedValue({
        seats: [{ id: 'seat-1' }],
        booking: { id: 'booking-123' },
        bookingId: 'booking-123',
        count: 1,
      });

      await bookingController.lockSeats(mockReq, mockRes);

      expect(mockBookingService.lockSeats).toHaveBeenCalledWith({
        seatIds: undefined,
        seatId: 'seat-1',
        userId: 'user-123',
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 when neither seatId nor seatIds provided', async () => {
      mockReq.body = {};

      await bookingController.lockSeats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Either seatId or seatIds array is required',
      });
      expect(mockBookingService.lockSeats).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockReq.body = { seatId: 'seat-1' };
      mockBookingService.lockSeats.mockRejectedValue(new Error('Seats not available'));

      await bookingController.lockSeats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Seats not available',
      });
    });
  });

  describe('confirmBooking', () => {
    it('should confirm booking successfully', async () => {
      const bookingId = 'booking-123';
      mockReq.params = { bookingId };
      const confirmedBooking = {
        id: bookingId,
        status: BookingStatus.CONFIRMED,
      };
      mockBookingService.confirmBooking.mockResolvedValue(confirmedBooking);

      await bookingController.confirmBooking(mockReq, mockRes);

      expect(mockBookingService.confirmBooking).toHaveBeenCalledWith({
        bookingId,
        userId: 'user-123',
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(confirmedBooking);
    });

    it('should return 400 when bookingId is missing', async () => {
      mockReq.params = {};

      await bookingController.confirmBooking(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'bookingId is required',
      });
      expect(mockBookingService.confirmBooking).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockReq.params = { bookingId: 'booking-123' };
      mockBookingService.confirmBooking.mockRejectedValue(new Error('Booking not found'));

      await bookingController.confirmBooking(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Booking not found',
      });
    });
  });

  describe('cancelBooking', () => {
    it('should cancel CONFIRMED booking successfully', async () => {
      const bookingId = 'booking-123';
      mockReq.params = { bookingId };
      const cancelledBooking = {
        id: bookingId,
        status: BookingStatus.CANCELLED,
      };
      mockBookingService.cancelBooking.mockResolvedValue(cancelledBooking);

      await bookingController.cancelBooking(mockReq, mockRes);

      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith(bookingId, 'user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(cancelledBooking);
    });

    it('should handle PENDING booking cancellation (deleted)', async () => {
      const bookingId = 'booking-123';
      mockReq.params = { bookingId };
      mockBookingService.cancelBooking.mockResolvedValue(null);

      await bookingController.cancelBooking(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Pending booking has been released. The booking was never confirmed, so it has been removed.',
        deleted: true,
      });
    });

    it('should return 400 when bookingId is missing', async () => {
      mockReq.params = {};

      await bookingController.cancelBooking(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'bookingId is required',
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { bookingId: 'booking-123' };
      mockBookingService.cancelBooking.mockRejectedValue(new Error('Booking not found'));

      await bookingController.cancelBooking(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Booking not found',
      });
    });
  });

  describe('getUserBookings', () => {
    it('should get user bookings successfully', async () => {
      const bookings = [{ id: 'booking-1' }, { id: 'booking-2' }];
      mockReq.query = { page: '1', limit: '10' };
      mockBookingService.getUserBookingsPaginated.mockResolvedValue({
        data: bookings,
        total: 2,
        page: 1,
        limit: 10,
      });

      await bookingController.getUserBookings(mockReq, mockRes);

      expect(mockBookingService.getUserBookingsPaginated).toHaveBeenCalledWith(
        'user-123',
        1,
        10,
        undefined
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should get user bookings with status filter', async () => {
      mockReq.query = { page: '1', limit: '10', status: BookingStatus.CONFIRMED };
      mockBookingService.getUserBookingsPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await bookingController.getUserBookings(mockReq, mockRes);

      expect(mockBookingService.getUserBookingsPaginated).toHaveBeenCalledWith(
        'user-123',
        1,
        10,
        BookingStatus.CONFIRMED
      );
    });

    it('should handle service errors', async () => {
      mockReq.query = {};
      mockBookingService.getUserBookingsPaginated.mockRejectedValue(new Error('Database error'));

      await bookingController.getUserBookings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Database error',
      });
    });
  });

  describe('getBookingById', () => {
    it('should get booking by id successfully', async () => {
      const bookingId = 'booking-123';
      mockReq.params = { bookingId };
      const booking = { id: bookingId, userId: 'user-123' };
      mockBookingService.getBookingById.mockResolvedValue(booking);

      await bookingController.getBookingById(mockReq, mockRes);

      expect(mockBookingService.getBookingById).toHaveBeenCalledWith(bookingId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(booking);
    });

    it('should return 400 when bookingId is missing', async () => {
      mockReq.params = {};

      await bookingController.getBookingById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'bookingId is required',
      });
    });

    it('should return 404 when booking not found', async () => {
      mockReq.params = { bookingId: 'invalid-id' };
      mockBookingService.getBookingById.mockRejectedValue(new Error('Booking not found'));

      await bookingController.getBookingById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Booking not found',
      });
    });
  });

  describe('getAllBookings', () => {
    it('should get all bookings successfully', async () => {
      const bookings = [{ id: 'booking-1' }, { id: 'booking-2' }];
      mockReq.query = { page: '1', limit: '10' };
      mockBookingService.getAllBookingsPaginated.mockResolvedValue({
        data: bookings,
        total: 2,
        page: 1,
        limit: 10,
      });

      await bookingController.getAllBookings(mockReq, mockRes);

      expect(mockBookingService.getAllBookingsPaginated).toHaveBeenCalledWith(
        1,
        10,
        null,
        null,
        null
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should get all bookings with filters', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        status: BookingStatus.CONFIRMED,
        userId: 'user-123',
        showId: 'show-123',
      };
      mockBookingService.getAllBookingsPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await bookingController.getAllBookings(mockReq, mockRes);

      expect(mockBookingService.getAllBookingsPaginated).toHaveBeenCalledWith(
        1,
        10,
        BookingStatus.CONFIRMED,
        'user-123',
        'show-123'
      );
    });

    it('should handle service errors', async () => {
      mockReq.query = {};
      mockBookingService.getAllBookingsPaginated.mockRejectedValue(new Error('Database error'));

      await bookingController.getAllBookings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Database error',
      });
    });
  });
});

