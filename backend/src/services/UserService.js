import { hashPassword, verifyPassword } from '../utils/password.js';

/**
 * @typedef {import('../repositories/UserRepository.js').UserRepository} UserRepository
 */

export class UserService {
  /**
   * @param {UserRepository} userRepository
   */
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * @param {{ name: string, email: string, password: string }} data
   * @returns {Promise<import('@prisma/client').User>}
   */
  async createUser(data) {
    const { name, email, password } = data;

    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const { hash, salt } = await hashPassword(password);

    return this.userRepository.create({
      name,
      email,
      password: hash,
      salt,
    });
  }

  /**
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Omit<import('@prisma/client').User, 'password' | 'salt'> | null>}
   */
  async verifyCredentials(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null; // User not found
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return null; // Invalid password
    }

    const { password: _, salt: __, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * @param {string} id
   * @returns {Promise<Omit<import('@prisma/client').User, 'password' | 'salt'>>}
   */
  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const { password: _, salt: __, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<{ data: Array<Omit<import('@prisma/client').User, 'password' | 'salt'>>, total: number, page: number, limit: number }>}
   */
  async getAllUsersPaginated(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.userRepository.findAllPaginated(skip, limit);
    
    const usersWithoutPassword = data.map(({ password: _, salt: __, ...user }) => user);
    
    return {
      data: usersWithoutPassword,
      total,
      page,
      limit,
    };
  }
}

