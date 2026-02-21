import { parsePagination, formatPaginationResponse } from '../utils/pagination.js';
import { generateToken } from '../utils/jwt.js';

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('../services/AdminService.js').AdminService} AdminService
 */

export class AdminController {
  /**
   * @param {AdminService} adminService
   */
  constructor(adminService) {
    this.adminService = adminService;
  }

  register = async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({ error: 'Name, email, and password are required' });
        return;
      }

      const admin = await this.adminService.createAdmin({ name, email, password });
      res.status(201).json({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        createdAt: admin.createdAt,
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  login = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const admin = await this.adminService.verifyCredentials(email, password);
      if (!admin) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const token = generateToken({
        adminId: admin.id,
        email: admin.email,
        type: 'admin',
      });

      // Set HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        createdAt: admin.createdAt,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  getAdminById = async (req, res) => {
    try {
      const admin = await this.adminService.getAdminById(req.params.id);
      res.json(admin);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };

  getAllAdmins = async (req, res) => {
    try {
      const { page, limit } = parsePagination(req.query, 10, 100);
      
      const { data, total, page: currentPage, limit: currentLimit } = 
        await this.adminService.getAllAdminsPaginated(page, limit);
      
      const response = formatPaginationResponse(data, total, currentPage, currentLimit);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  logout = async (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  };
}

