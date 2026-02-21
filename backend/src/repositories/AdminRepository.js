import { prisma } from '../config/database.js';

export class AdminRepository {
  /**
   * @param {import('@prisma/client').Prisma.AdminCreateInput} data
   * @returns {Promise<import('@prisma/client').Admin>}
   */
  async create(data) {
    return prisma.admin.create({ data });
  }

  /**
   * @param {string} id
   * @returns {Promise<import('@prisma/client').Admin | null>}
   */
  async findById(id) {
    return prisma.admin.findUnique({ where: { id } });
  }

  /**
   * @param {string} email
   * @returns {Promise<import('@prisma/client').Admin | null>}
   */
  async findByEmail(email) {
    return prisma.admin.findUnique({ where: { email } });
  }

  /**
   * @returns {Promise<Array<import('@prisma/client').Admin>>}
   */
  async findAll() {
    return prisma.admin.findMany();
  }

  /**
   * @param {number} skip
   * @param {number} take
   * @returns {Promise<{ data: Array<import('@prisma/client').Admin>, total: number }>}
   */
  async findAllPaginated(skip = 0, take = 10) {
    const [data, total] = await Promise.all([
      prisma.admin.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.admin.count(),
    ]);
    return { data, total };
  }
}

