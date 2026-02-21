import { prisma } from '../config/database.js';

export class EventRepository {
  /**
   * @param {import('@prisma/client').Prisma.EventCreateInput} data
   * @returns {Promise<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>}
   */
  async create(data) {
    return prisma.event.create({ data });
  }

  /**
   * @param {string} id
   * @returns {Promise<(import('@prisma/client').Event & { venue: import('@prisma/client').Venue }) | null>}
   */
  async findById(id) {
    return prisma.event.findUnique({ 
      where: { id },
      include: { venue: true }
    });
  }

  /**
   * @returns {Promise<Array<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>>}
   */
  async findAll() {
    return prisma.event.findMany({ include: { venue: true } });
  }

  /**
   * @param {number} skip
   * @param {number} take
   * @returns {Promise<{ data: Array<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>, total: number }>}
   */
  async findAllPaginated(skip = 0, take = 10) {
    const [data, total] = await Promise.all([
      prisma.event.findMany({
        skip,
        take,
        include: { venue: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.event.count(),
    ]);
    return { data, total };
  }

  /**
   * @param {string} venueId
   * @returns {Promise<Array<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>>}
   */
  async findByVenueId(venueId) {
    return prisma.event.findMany({ 
      where: { venueId },
      include: { venue: true }
    });
  }
}

