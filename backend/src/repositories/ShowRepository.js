import { prisma } from '../config/database.js';

export class ShowRepository {
  /**
   * @param {import('@prisma/client').Prisma.ShowCreateInput} data
   * @returns {Promise<import('@prisma/client').Show>}
   */
  async create(data) {
    return prisma.show.create({ data });
  }

  /**
   * @param {string} id
   * @returns {Promise<(import('@prisma/client').Show & { event: any, createdByAdmin: any }) | null>}
   */
  async findById(id) {
    return prisma.show.findUnique({ 
      where: { id },
      include: { 
        event: { include: { venue: true } },
        createdByAdmin: true
      }
    });
  }

  /**
   * @param {string} eventId
   * @returns {Promise<Array<import('@prisma/client').Show & { event: any }>>}
   */
  async findByEventId(eventId) {
    return prisma.show.findMany({ 
      where: { eventId },
      include: { event: { include: { venue: true } } }
    });
  }

  /**
   * @param {import('@prisma/client').ShowStatus} status
   * @returns {Promise<Array<import('@prisma/client').Show & { event: any }>>}
   */
  async findByStatus(status) {
    return prisma.show.findMany({ 
      where: { status },
      include: { event: { include: { venue: true } } }
    });
  }

  /**
   * @param {import('@prisma/client').ShowStatus} status
   * @param {number} skip
   * @param {number} take
   * @returns {Promise<{ data: Array<import('@prisma/client').Show & { event: any }>, total: number }>}
   */
  async findByStatusPaginated(status, skip = 0, take = 10) {
    const [data, total] = await Promise.all([
      prisma.show.findMany({
        where: { status },
        skip,
        take,
        include: { event: { include: { venue: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.show.count({ where: { status } }),
    ]);
    return { data, total };
  }

  /**
   * @param {number} skip
   * @param {number} take
   * @param {import('@prisma/client').ShowStatus} [status]
   * @returns {Promise<{ data: Array<import('@prisma/client').Show & { event: any }>, total: number }>}
   */
  async findAllPaginated(skip = 0, take = 10, status = null) {
    const whereClause = status ? { status } : {};
    const [data, total] = await Promise.all([
      prisma.show.findMany({
        where: whereClause,
        skip,
        take,
        include: { event: { include: { venue: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.show.count({ where: whereClause }),
    ]);
    return { data, total };
  }

  /**
   * @param {string} id
   * @param {import('@prisma/client').ShowStatus} status
   * @returns {Promise<import('@prisma/client').Show>}
   */
  async updateStatus(id, status) {
    return prisma.show.update({
      where: { id },
      data: { status }
    });
  }
}

