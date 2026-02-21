import { parsePagination, formatPaginationResponse } from '../utils/pagination.js';
import { generateToken } from '../utils/jwt.js';

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('../services/UserService.js').UserService} UserService
 */

export class UserController {
  /**
   * @param {UserService} userService
   */
  constructor(userService) {
    this.userService = userService;
  }

  register = async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({ error: 'Name, email, and password are required' });
        return;
      }

      const user = await this.userService.createUser({ name, email, password });
      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
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

      const user = await this.userService.verifyCredentials(email, password);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        type: 'user',
      });

      // Set HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  getMyProfile = async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await this.userService.getUserById(userId);
      res.json(user);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };

  getUserById = async (req, res) => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      res.json(user);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };

  getAllUsers = async (req, res) => {
    try {
      const { page, limit } = parsePagination(req.query, 10, 100);
      
      const { data, total, page: currentPage, limit: currentLimit } = 
        await this.userService.getAllUsersPaginated(page, limit);
      
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

