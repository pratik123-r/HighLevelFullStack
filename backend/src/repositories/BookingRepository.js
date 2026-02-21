import { prisma } from '../config/database.js';

export class BookingRepository {
  /**
   * @param {import('@prisma/client').Prisma.BookingCreateInput} data
   * @returns {Promise<import('@prisma/client').Booking & { user: any, show: any, seat: any }>}
   */
  async create(data) {
    return prisma.booking.create({ 
      data,
      include: {
        user: true,
        show: { include: { event: { include: { venue: true } } } },
        seat: true
      }
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<(import('@prisma/client').Booking & { user: any, show: any, seat: any }) | null>}
   */
  async findById(id) {
    return prisma.booking.findUnique({ 
      where: { id },
      include: {
        user: true,
        show: { include: { event: { include: { venue: true } } } },
        seat: true
      }
    });
  }

  /**
   * @param {string} userId
   * @returns {Promise<Array<import('@prisma/client').Booking & { show: any, seat: any }>>}
   */
  async findByUserId(userId) {
    return prisma.booking.findMany({ 
      where: { userId },
      include: {
        show: { include: { event: { include: { venue: true } } } },
        seat: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * @param {string} userId
   * @param {number} skip
   * @param {number} take
   * @returns {Promise<{ data: Array<import('@prisma/client').Booking & { show: any, seat: any }>, total: number }>}
   */
  async findByUserIdPaginated(userId, skip = 0, take = 10) {
    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where: { userId },
        skip,
        take,
        include: {
          show: { include: { event: { include: { venue: true } } } },
          seat: true
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.count({ where: { userId } }),
    ]);
    return { data, total };
  }

  /**
   * @param {string} showId
   * @returns {Promise<Array<import('@prisma/client').Booking & { user: any, seat: any }>>}
   */
  async findByShowId(showId) {
    return prisma.booking.findMany({ 
      where: { showId },
      include: { user: true, seat: true }
    });
  }

  /**
   * @param {string} id
   * @param {import('@prisma/client').BookingStatus} status
   * @returns {Promise<import('@prisma/client').Booking & { user: any, show: any, seat: any }>}
   */
  async updateStatus(id, status) {
    return prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        user: true,
        show: { include: { event: { include: { venue: true } } } },
        seat: true
      }
    });
  }
}

