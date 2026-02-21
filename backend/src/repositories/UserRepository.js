import { prisma } from '../config/database.js';

export class UserRepository {
  /**
   * @param {import('@prisma/client').Prisma.UserCreateInput} data
   * @returns {Promise<import('@prisma/client').User>}
   */
  async create(data) {
    return prisma.user.create({ data });
  }

  /**
   * @param {string} id
   * @returns {Promise<import('@prisma/client').User | null>}
   */
  async findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  /**
   * @param {string} email
   * @returns {Promise<import('@prisma/client').User | null>}
   */
  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  /**
   * @returns {Promise<Array<import('@prisma/client').User>>}
   */
  async findAll() {
    return prisma.user.findMany();
  }

  /**
   * @param {number} skip
   * @param {number} take
   * @returns {Promise<{ data: Array<import('@prisma/client').User>, total: number }>}
   */
  async findAllPaginated(skip = 0, take = 10) {
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);
    return { data, total };
  }
}

