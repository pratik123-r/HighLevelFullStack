import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockRedis = {
  script: jest.fn(),
  evalsha: jest.fn(),
  on: jest.fn(),
};

// Mock ioredis using unstable_mockModule for ES modules
jest.unstable_mockModule('ioredis', () => {
  return {
    default: jest.fn().mockImplementation(() => mockRedis),
  };
});

// Mock the config file to export our mock redis
jest.unstable_mockModule('../../src/config/redis.js', () => ({
  redis: mockRedis,
}));

const { createRateLimiter, default: rateLimiter } = await import('../../src/middleware/rateLimiter.js');

describe('rateLimiter middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      ip: '127.0.0.1',
      method: 'GET',
      path: '/api/test',
      url: '/api/test',
      headers: {},
      connection: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('createRateLimiter', () => {
    it('should allow request when tokens available', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockResolvedValue([1, 99, Date.now() + 1000]);

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    });

    it('should reject request when no tokens available', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      const resetTime = Date.now() + 5000;
      mockRedis.evalsha.mockResolvedValue([0, 0, resetTime]);

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests. Please try again later.',
        retryAfterSeconds: expect.any(Number),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call onLimitReached callback when provided', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockResolvedValue([0, 0, Date.now() + 1000]);

      const onLimitReached = jest.fn();

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
        onLimitReached,
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(onLimitReached).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should use custom key generator', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockResolvedValue([1, 99, Date.now() + 1000]);

      const keyGenerator = jest.fn().mockReturnValue('custom-key');

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
        keyGenerator,
        keyPrefix: 'custom:',
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(keyGenerator).toHaveBeenCalledWith(mockReq);
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        'script-sha-123',
        1,
        'custom:custom-key',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '1'
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockRejectedValue(new Error('Redis error'));

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error for invalid configuration', () => {
      expect(() => {
        createRateLimiter({
          maxTokens: 0,
          refillRate: 10,
          windowMs: 1000,
        });
      }).toThrow('maxTokens, refillRate, and windowMs must be positive numbers');

      expect(() => {
        createRateLimiter({
          maxTokens: 100,
          refillRate: -5,
          windowMs: 1000,
        });
      }).toThrow('maxTokens, refillRate, and windowMs must be positive numbers');
    });

    it('should set rate limit headers', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockResolvedValue([1, 50, Date.now() + 2000]);

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '50');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });
  });

  describe('default rateLimiter', () => {
    it('should create rate limiter with requests and window', () => {
      expect(() => {
        rateLimiter(10, 60000);
      }).not.toThrow();
    });

    it('should throw error for invalid requests', () => {
      expect(() => {
        rateLimiter(0, 60000);
      }).toThrow('requests must be a positive number');

      expect(() => {
        rateLimiter(-5, 60000);
      }).toThrow('requests must be a positive number');
    });

    it('should throw error for invalid windowMs', () => {
      expect(() => {
        rateLimiter(10, 0);
      }).toThrow('windowMs must be a positive number');

      expect(() => {
        rateLimiter(10, -1000);
      }).toThrow('windowMs must be a positive number');
    });

    it('should use requests as both maxTokens and refillRate', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockResolvedValue([1, 4, Date.now() + 1000]);

      const limiter = rateLimiter(5, 60000);

      await limiter(mockReq, mockRes, mockNext);

      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.any(String),
        '5', // maxTokens
        '5', // refillRate
        '60000', // windowMs
        expect.any(String),
        '1'
      );
    });
  });

  describe('defaultKeyGenerator', () => {
    it('should use x-forwarded-for header when available', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockResolvedValue([1, 99, Date.now() + 1000]);

      mockReq.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.stringContaining('192.168.1.1'),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '1'
      );
    });

    it('should use req.ip when available', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockResolvedValue([1, 99, Date.now() + 1000]);

      mockReq.ip = '192.168.1.100';
      mockReq.headers = {};

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.stringContaining('192.168.1.100'),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '1'
      );
    });

    it('should use unknown when IP not available', async () => {
      mockRedis.script.mockResolvedValue('script-sha-123');
      mockRedis.evalsha.mockResolvedValue([1, 99, Date.now() + 1000]);

      mockReq.ip = undefined;
      mockReq.connection = {};

      const limiter = createRateLimiter({
        maxTokens: 100,
        refillRate: 10,
        windowMs: 1000,
      });

      await limiter(mockReq, mockRes, mockNext);

      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.stringContaining('unknown'),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '1'
      );
    });
  });
});

