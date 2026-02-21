import { prisma } from '../config/database.js';

export class VenueRepository {
  /**
   * @param {import('@prisma/client').Prisma.VenueCreateInput} data
   * @returns {Promise<import('@prisma/client').Venue>}
   */
  async create(data) {
    return prisma.venue.create({ data });
  }

  /**
   * @param {string} id
   * @returns {Promise<import('@prisma/client').Venue | null>}
   */
  async findById(id) {
    return prisma.venue.findUnique({ where: { id } });
  }

  /**
   * @returns {Promise<Array<import('@prisma/client').Venue>>}
   */
  async findAll() {
    return prisma.venue.findMany();
  }

  /**
   * @param {number} skip
   * @param {number} take
   * @returns {Promise<{ data: Array<import('@prisma/client').Venue>, total: number }>}
   */
  async findAllPaginated(skip = 0, take = 10) {
    const [data, total] = await Promise.all([
      prisma.venue.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.venue.count(),
    ]);
    return { data, total };
  }
}

