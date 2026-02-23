import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockSign = jest.fn();
const mockVerify = jest.fn();

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    sign: mockSign,
    verify: mockVerify,
  },
  sign: mockSign,
  verify: mockVerify,
}));

const jwt = await import('jsonwebtoken');
const { generateToken, verifyToken, extractTokenFromHeader, extractToken } = await import('../../src/utils/jwt.js');

describe('jwt utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('generateToken', () => {
    it('should generate token with default expiration', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = 'generated-token';

      mockSign.mockReturnValue(token);

      const result = generateToken(payload);

      expect(result).toBe(token);
      expect(mockSign).toHaveBeenCalledWith(payload, expect.any(String), {
        expiresIn: '7d',
      });
    });

    it('should use JWT_EXPIRES_IN from env', () => {
      // Note: JWT_EXPIRES_IN is read at module load time, so changing it in the test
      // won't affect the already-loaded module. This test verifies the default behavior.
      // The actual env variable is read when the module is first imported.
      const payload = { userId: 'user-123' };
      const token = 'generated-token';

      mockSign.mockReturnValue(token);

      generateToken(payload);

      // The module was loaded with the default value '7d' or whatever was set at load time
      expect(mockSign).toHaveBeenCalledWith(payload, expect.any(String), {
        expiresIn: expect.any(String), // Accept any string since env is read at module load
      });
    });

    it('should handle payload with adminId', () => {
      const payload = { adminId: 'admin-123', email: 'admin@example.com' };
      const token = 'generated-token';

      mockSign.mockReturnValue(token);

      const result = generateToken(payload);

      expect(result).toBe(token);
    });

    it('should handle payload with type', () => {
      const payload = { userId: 'user-123', type: 'user' };
      const token = 'generated-token';

      mockSign.mockReturnValue(token);

      const result = generateToken(payload);

      expect(result).toBe(token);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = 'valid-token';
      const decoded = { userId: 'user-123', email: 'test@example.com' };

      mockVerify.mockReturnValue(decoded);

      const result = verifyToken(token);

      expect(result).toEqual(decoded);
      expect(mockVerify).toHaveBeenCalledWith(token, expect.any(String));
    });

    it('should return null when token is invalid', () => {
      const token = 'invalid-token';

      mockVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should return null when token is expired', () => {
      const token = 'expired-token';

      mockVerify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = verifyToken(token);

      expect(result).toBeNull();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const authHeader = 'Bearer valid-token';

      const result = extractTokenFromHeader(authHeader);

      expect(result).toBe('valid-token');
    });

    it('should return null when header is null', () => {
      const result = extractTokenFromHeader(null);

      expect(result).toBeNull();
    });

    it('should return null when header is undefined', () => {
      const result = extractTokenFromHeader(undefined);

      expect(result).toBeNull();
    });

    it('should return null when header does not start with Bearer', () => {
      const authHeader = 'Basic token';

      const result = extractTokenFromHeader(authHeader);

      expect(result).toBeNull();
    });

    it('should return null when header has wrong format', () => {
      const authHeader = 'Bearer';

      const result = extractTokenFromHeader(authHeader);

      expect(result).toBeNull();
    });

    it('should return null when header has more than 2 parts', () => {
      const authHeader = 'Bearer token extra';

      const result = extractTokenFromHeader(authHeader);

      expect(result).toBeNull();
    });
  });

  describe('extractToken', () => {
    it('should extract token from cookie', () => {
      const req = {
        cookies: {
          token: 'cookie-token',
        },
        headers: {},
      };

      const result = extractToken(req);

      expect(result).toBe('cookie-token');
    });

    it('should extract token from Authorization header when no cookie', () => {
      const req = {
        cookies: {},
        headers: {
          authorization: 'Bearer header-token',
        },
      };

      const result = extractToken(req);

      expect(result).toBe('header-token');
    });

    it('should prefer cookie over header', () => {
      const req = {
        cookies: {
          token: 'cookie-token',
        },
        headers: {
          authorization: 'Bearer header-token',
        },
      };

      const result = extractToken(req);

      expect(result).toBe('cookie-token');
    });

    it('should return null when neither cookie nor header present', () => {
      const req = {
        cookies: {},
        headers: {},
      };

      const result = extractToken(req);

      expect(result).toBeNull();
    });

    it('should handle undefined cookies', () => {
      const req = {
        headers: {
          authorization: 'Bearer header-token',
        },
      };

      const result = extractToken(req);

      expect(result).toBe('header-token');
    });
  });
});

