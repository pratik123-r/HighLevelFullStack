import { parsePagination, formatPaginationResponse } from '../utils/pagination.js';

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

/**
 * @typedef {import('../services/BookingService.js').BookingService} BookingService
 */

export class BookingController {
  /**
   * @param {BookingService} bookingService
   */
  constructor(bookingService) {
    this.bookingService = bookingService;
  }

  lockSeats = async (req, res) => {
    try {
      const { seatIds, seatId } = req.body;
      const userId = /** @type {any} */ (req).user.id;
      
      if (!seatIds && !seatId) {
        res.status(400).json({ error: 'Either seatId or seatIds array is required' });
        return;
      }

      const result = await this.bookingService.lockSeats({ seatIds, seatId, userId });
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  confirmBooking = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const userId = /** @type {any} */ (req).user.id;
      
      if (!bookingId) {
        res.status(400).json({ error: 'bookingId is required' });
        return;
      }

      const booking = await this.bookingService.confirmBooking({ bookingId, userId });
      res.status(200).json(booking);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  cancelBooking = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const userId = /** @type {any} */ (req).user.id;
      
      if (!bookingId) {
        res.status(400).json({ error: 'bookingId is required' });
        return;
      }

      const booking = await this.bookingService.cancelBooking(bookingId, userId);
      
      // If booking was deleted (PENDING), return success message
      if (booking === null) {
        res.status(200).json({ 
          message: 'Pending booking has been released. The booking was never confirmed, so it has been removed.',
          deleted: true 
        });
        return;
      }

      // If booking was cancelled (CONFIRMED), return the cancelled booking
      res.status(200).json(booking);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  getUserBookings = async (req, res) => {
    try {
      const userId = /** @type {any} */ (req).user.id;
      const { page, limit } = parsePagination(req.query);
      const { status } = req.query; // Optional status filter: PENDING, CONFIRMED, CANCELLED
      
      const result = await this.bookingService.getUserBookingsPaginated(userId, page, limit, status);
      res.status(200).json(formatPaginationResponse(result.data, result.total, page, limit));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  getBookingById = async (req, res) => {
    try {
      const { bookingId } = req.params;
      
      if (!bookingId) {
        res.status(400).json({ error: 'bookingId is required' });
        return;
      }

      const booking = await this.bookingService.getBookingById(bookingId);
      res.status(200).json(booking);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };

  getAllBookings = async (req, res) => {
    try {
      const { page, limit } = parsePagination(req.query);
      const { status, userId, showId } = req.query; // Optional filters
      
      const result = await this.bookingService.getAllBookingsPaginated(
        page, 
        limit, 
        status || null, 
        userId || null, 
        showId || null
      );
      res.status(200).json(formatPaginationResponse(result.data, result.total, page, limit));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
}
