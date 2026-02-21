import { SeatStatus } from '@prisma/client';

/**
 * @typedef {import('../repositories/SeatRepository.js').SeatRepository} SeatRepository
 * @typedef {import('../repositories/ShowRepository.js').ShowRepository} ShowRepository
 */

export class SeatService {
  /**
   * @param {SeatRepository} seatRepository
   * @param {ShowRepository} showRepository
   */
  constructor(seatRepository, showRepository) {
    this.seatRepository = seatRepository;
    this.showRepository = showRepository;
  }

  /**
   * Check if a seat is locked based on lockedTill
   * @param {import('@prisma/client').Seat} seat
   * @returns {boolean}
   */
  isSeatLocked(seat) {
    if (!seat.lockedTill) {
      return false;
    }
    
    const now = new Date();
    const lockedTill = new Date(seat.lockedTill);
    
    return lockedTill > now;
  }

  /**
   * Add isLocked field to seat objects
   * @param {Array<import('@prisma/client').Seat>} seats
   * @returns {Array<import('@prisma/client').Seat & { isLocked: boolean }>}
   */
  enrichSeatsWithLockStatus(seats) {
    return seats.map(seat => {
      const plainSeat = JSON.parse(JSON.stringify(seat));
      plainSeat.isLocked = this.isSeatLocked(seat);
      return plainSeat;
    });
  }

  /**
   * @param {string} showId
   * @param {string} [status] - Unused parameter, kept for API compatibility
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<{ data: Array<import('@prisma/client').Seat & { isLocked: boolean }>, total: number, page: number, limit: number }>}
   */
  async getSeatsByShowPaginated(showId, status, page = 1, limit = 10) {
    const show = await this.showRepository.findById(showId);
    if (!show) {
      throw new Error('Show not found');
    }

    const data = await this.seatRepository.findByShowId(showId);
    const enrichedData = this.enrichSeatsWithLockStatus(data);
    
    return {
      data: enrichedData,
      total: data.length,
      page: 1,
      limit: data.length,
    };
  }

}

