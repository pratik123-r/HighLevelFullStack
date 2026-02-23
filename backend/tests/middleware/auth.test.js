import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockExtractToken = jest.fn();
const mockVerifyToken = jest.fn();

jest.unstable_mockModule('../../src/utils/jwt.js', () => ({
  extractToken: mockExtractToken,
  verifyToken: mockVerifyToken,
  extractTokenFromHeader: jest.fn(),
  generateToken: jest.fn(),
}));

const { authenticateUser, authenticateAdmin } = await import('../../src/middleware/auth.js');

describe('auth middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      cookies: {},
      headers: {},
      ip: '127.0.0.1',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid token', () => {
      const token = 'valid-token';
      const decoded = {
        userId: 'user-123',
        email: 'user@example.com',
        type: 'user',
      };

      mockExtractToken.mockReturnValue(token);
      mockVerifyToken.mockReturnValue(decoded);

      authenticateUser(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        type: 'user',
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should use id when userId not present', () => {
      const token = 'valid-token';
      const decoded = {
        id: 'user-123',
        email: 'user@example.com',
      };

      mockExtractToken.mockReturnValue(token);
      mockVerifyToken.mockReturnValue(decoded);

      authenticateUser(mockReq, mockRes, mockNext);

      expect(mockReq.user.id).toBe('user-123');
      expect(mockReq.user.type).toBe('user');
    });

    it('should return 401 when token is missing', () => {
      mockExtractToken.mockReturnValue(null);

      authenticateUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required. Please provide a valid token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      mockExtractToken.mockReturnValue('invalid-token');
      mockVerifyToken.mockReturnValue(null);

      authenticateUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when token type is not user', () => {
      const token = 'admin-token';
      const decoded = {
        userId: 'admin-123',
        email: 'admin@example.com',
        type: 'admin',
      };

      mockExtractToken.mockReturnValue(token);
      mockVerifyToken.mockReturnValue(decoded);

      authenticateUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied. User token required.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockExtractToken.mockImplementation(() => {
        throw new Error('Extraction error');
      });

      authenticateUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed.',
      });
    });
  });

  describe('authenticateAdmin', () => {
    it('should authenticate admin with valid token', () => {
      const token = 'valid-token';
      const decoded = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        type: 'admin',
      };

      mockExtractToken.mockReturnValue(token);
      mockVerifyToken.mockReturnValue(decoded);

      authenticateAdmin(mockReq, mockRes, mockNext);

      expect(mockReq.admin).toEqual({
        id: 'admin-123',
        email: 'admin@example.com',
        type: 'admin',
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should use id when adminId not present', () => {
      const token = 'valid-token';
      const decoded = {
        id: 'admin-123',
        email: 'admin@example.com',
      };

      mockExtractToken.mockReturnValue(token);
      mockVerifyToken.mockReturnValue(decoded);

      authenticateAdmin(mockReq, mockRes, mockNext);

      expect(mockReq.admin.id).toBe('admin-123');
      expect(mockReq.admin.type).toBe('admin');
    });

    it('should return 401 when token is missing', () => {
      mockExtractToken.mockReturnValue(null);

      authenticateAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required. Please provide a valid token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      mockExtractToken.mockReturnValue('invalid-token');
      mockVerifyToken.mockReturnValue(null);

      authenticateAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when token type is not admin', () => {
      const token = 'user-token';
      const decoded = {
        userId: 'user-123',
        email: 'user@example.com',
        type: 'user',
      };

      mockExtractToken.mockReturnValue(token);
      mockVerifyToken.mockReturnValue(decoded);

      authenticateAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied. Admin token required.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockExtractToken.mockImplementation(() => {
        throw new Error('Extraction error');
      });

      authenticateAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed.',
      });
    });
  });
});

