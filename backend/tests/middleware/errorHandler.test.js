import { describe, it, expect, jest } from '@jest/globals';
import { errorHandler, AppError } from '../../src/middleware/errorHandler.js';

describe('errorHandler middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();

    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('AppError', () => {
    it('should create AppError with status code and message', () => {
      const error = new AppError(404, 'Not found');

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
      expect(error.isOperational).toBe(true);
    });

    it('should allow custom isOperational flag', () => {
      const error = new AppError(500, 'Server error', false);

      expect(error.isOperational).toBe(false);
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError(404, 'Resource not found');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Resource not found',
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should handle generic Error as 500', () => {
      const error = new Error('Generic error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
      expect(console.error).toHaveBeenCalledWith('Unhandled error:', error);
    });

    it('should handle non-Error objects', () => {
      const error = { message: 'Something went wrong' };

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
      expect(console.error).toHaveBeenCalledWith('Unhandled error:', error);
    });

    it('should handle errors without message', () => {
      const error = new Error();

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
    });
  });
});

