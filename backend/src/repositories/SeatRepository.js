import { prisma } from '../config/database.js';

export class SeatRepository {
  /**
   * @param {Array<import('@prisma/client').Prisma.SeatCreateManyInput>} data
   * @returns {Promise<import('@prisma/client').Prisma.BatchPayload>}
   */
  async createMany(data) {
    return prisma.seat.createMany({ data, skipDuplicates: true });
  }

  /**
   * @param {string} id
   * @returns {Promise<(import('@prisma/client').Seat & { show: any, lockedByUser: any }) | null>}
   */
  async findById(id) {
    return prisma.seat.findUnique({ 
      where: { id },
      include: { show: true, lockedByUser: true }
    });
  }

  /**
   * @param {string[]} ids
   * @returns {Promise<Array<import('@prisma/client').Seat & { show: any, lockedByUser: any }>>}
   */
  async findByIds(ids) {
    return prisma.seat.findMany({
      where: { id: { in: ids } },
      include: { show: true, lockedByUser: true }
    });
  }

  /**
   * @param {string} showId
   * @returns {Promise<Array<import('@prisma/client').Seat>>}
   */
  async findByShowId(showId) {
    return prisma.seat.findMany({ where: { showId } });
  }

  /**
   * @param {string} showId
   * @param {number} skip
   * @param {number} take
   * @returns {Promise<{ data: Array<import('@prisma/client').Seat>, total: number }>}
   */
  async findByShowIdPaginated(showId, skip = 0, take = 10) {
    const [data, total] = await Promise.all([
      prisma.seat.findMany({
        where: { showId },
        skip,
        take,
        orderBy: { seatNumber: 'asc' },
      }),
      prisma.seat.count({ where: { showId } }),
    ]);
    return { data, total };
  }

  /**
   * @param {string} showId
   * @param {import('@prisma/client').SeatStatus} status
   * @returns {Promise<Array<import('@prisma/client').Seat>>}
   */
  async findByShowIdAndStatus(showId, status) {
    return prisma.seat.findMany({ where: { showId, status } });
  }

  /**
   * @param {string} showId
   * @param {import('@prisma/client').SeatStatus} status
   * @param {number} skip
   * @param {number} take
   * @returns {Promise<{ data: Array<import('@prisma/client').Seat>, total: number }>}
   */
  async findByShowIdAndStatusPaginated(showId, status, skip = 0, take = 10) {
    const [data, total] = await Promise.all([
      prisma.seat.findMany({
        where: { showId, status },
        skip,
        take,
        orderBy: { seatNumber: 'asc' },
      }),
      prisma.seat.count({ where: { showId, status } }),
    ]);
    return { data, total };
  }

  /**
   * @param {string} showId
   * @param {number} seatNumber
   * @returns {Promise<import('@prisma/client').Seat | null>}
   */
  async findByShowIdAndSeatNumber(showId, seatNumber) {
    return prisma.seat.findUnique({ 
      where: { 
        showId_seatNumber: { showId, seatNumber }
      }
    });
  }

  /**
   * @param {string} id
   * @param {import('@prisma/client').SeatStatus} status
   * @param {string | null} lockedByUserId
   * @param {Date | null} lockedAt
   * @returns {Promise<import('@prisma/client').Seat>}
   */
  async updateStatus(id, status, lockedByUserId = null, lockedAt = null) {
    return prisma.seat.update({
      where: { id },
      data: { 
        status,
        lockedByUserId,
        lockedAt
      }
    });
  }

  /**
   * @param {string} showId
   * @param {import('@prisma/client').SeatStatus} status
   * @returns {Promise<number>}
   */
  async countByShowIdAndStatus(showId, status) {
    return prisma.seat.count({ where: { showId, status } });
  }
}

