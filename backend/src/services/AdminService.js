import { hashPassword, verifyPassword } from '../utils/password.js';

/**
 * @typedef {import('../repositories/AdminRepository.js').AdminRepository} AdminRepository
 */

export class AdminService {
  /**
   * @param {AdminRepository} adminRepository
   */
  constructor(adminRepository) {
    this.adminRepository = adminRepository;
  }

  /**
   * @param {{ name: string, email: string, password: string }} data
   * @returns {Promise<import('@prisma/client').Admin>}
   */
  async createAdmin(data) {
    const { name, email, password } = data;

    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    const existingAdmin = await this.adminRepository.findByEmail(email);
    if (existingAdmin) {
      throw new Error('Admin with this email already exists');
    }

    const { hash, salt } = await hashPassword(password);

    return this.adminRepository.create({
      name,
      email,
      password: hash,
      salt,
    });
  }

  /**
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Omit<import('@prisma/client').Admin, 'password' | 'salt'> | null>}
   */
  async verifyCredentials(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const admin = await this.adminRepository.findByEmail(email);
    if (!admin) {
      return null; // Admin not found
    }

    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return null; // Invalid password
    }

    const { password: _, salt: __, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }

  /**
   * @param {string} id
   * @returns {Promise<Omit<import('@prisma/client').Admin, 'password' | 'salt'>>}
   */
  async getAdminById(id) {
    const admin = await this.adminRepository.findById(id);
    if (!admin) {
      throw new Error('Admin not found');
    }

    const { password: _, salt: __, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }

  /**
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<{ data: Array<Omit<import('@prisma/client').Admin, 'password' | 'salt'>>, total: number, page: number, limit: number }>}
   */
  async getAllAdminsPaginated(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.adminRepository.findAllPaginated(skip, limit);
    
    const adminsWithoutPassword = data.map(({ password: _, salt: __, ...admin }) => admin);
    
    return {
      data: adminsWithoutPassword,
      total,
      page,
      limit,
    };
  }
}

