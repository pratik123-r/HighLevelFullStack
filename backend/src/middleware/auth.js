import { extractToken, verifyToken } from '../utils/jwt.js';

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 */

/**
 * @param {Request & { user?: { id: string, email: string, type: string } }} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
export function authenticateUser(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    if (decoded.type && decoded.type !== 'user') {
      res.status(403).json({ error: 'Access denied. User token required.' });
      return;
    }

    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      type: decoded.type || 'user',
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed.' });
  }
}

/**
 * @param {Request & { admin?: { id: string, email: string, type: string } }} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
export function authenticateAdmin(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    if (decoded.type && decoded.type !== 'admin') {
      res.status(403).json({ error: 'Access denied. Admin token required.' });
      return;
    }

    req.admin = {
      id: decoded.adminId || decoded.id,
      email: decoded.email,
      type: decoded.type || 'admin',
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed.' });
  }
}

