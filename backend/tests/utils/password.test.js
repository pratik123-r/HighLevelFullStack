import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockGenSalt = jest.fn();
const mockHash = jest.fn();
const mockCompare = jest.fn();

jest.unstable_mockModule('bcrypt', () => ({
  default: {
    genSalt: mockGenSalt,
    hash: mockHash,
    compare: mockCompare,
  },
  genSalt: mockGenSalt,
  hash: mockHash,
  compare: mockCompare,
}));

const { hashPassword, verifyPassword } = await import('../../src/utils/password.js');

describe('password utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const plainPassword = 'password123';
      // bcrypt returns the salt as part of the hash, so we need to mock it correctly
      const fullHash = '$2b$10$gIaVk5fEjRS7EnfF8C.qyuGirNUUAv6QOAnUSeF8XWCrQOEJ89O3K';
      const salt = '$2b$10$gIaVk5fEjRS7EnfF8C.qyu';

      mockGenSalt.mockResolvedValue(salt);
      mockHash.mockResolvedValue(fullHash);

      const result = await hashPassword(plainPassword);

      expect(result.hash).toBe(fullHash);
      expect(result.salt).toBe(salt);
      expect(mockGenSalt).toHaveBeenCalledWith(10);
      expect(mockHash).toHaveBeenCalledWith(plainPassword, salt);
    });

    it('should throw error when password is not a string', async () => {
      await expect(hashPassword(123)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error when password is null', async () => {
      await expect(hashPassword(null)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error when password is undefined', async () => {
      await expect(hashPassword(undefined)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error when password is empty string', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error when password is less than 6 characters', async () => {
      await expect(hashPassword('12345')).rejects.toThrow(
        'Password must be at least 6 characters long'
      );
    });

    it('should accept password with exactly 6 characters', async () => {
      const plainPassword = '123456';
      const fullHash = '$2b$10$x1Xi2TOhoIH3SGgp4VXyL.y9lkltU3vLHHOn8hsnN6P/2hASt7GJq';
      const salt = '$2b$10$x1Xi2TOhoIH3SGgp4VXyL.';

      mockGenSalt.mockResolvedValue(salt);
      mockHash.mockResolvedValue(fullHash);

      const result = await hashPassword(plainPassword);

      expect(result.hash).toBe(fullHash);
      expect(result.salt).toBe(salt);
    });
  });

  describe('verifyPassword', () => {
    it('should return true when password matches', async () => {
      const plainPassword = 'password123';
      const hash = 'hashed-password';

      mockCompare.mockResolvedValue(true);

      const result = await verifyPassword(plainPassword, hash);

      expect(result).toBe(true);
      expect(mockCompare).toHaveBeenCalledWith(plainPassword, hash);
    });

    it('should return false when password does not match', async () => {
      const plainPassword = 'password123';
      const hash = 'hashed-password';

      mockCompare.mockResolvedValue(false);

      const result = await verifyPassword(plainPassword, hash);

      expect(result).toBe(false);
    });

    it('should return false when plainPassword is null', async () => {
      const result = await verifyPassword(null, 'hash');

      expect(result).toBe(false);
      expect(mockCompare).not.toHaveBeenCalled();
    });

    it('should return false when plainPassword is undefined', async () => {
      const result = await verifyPassword(undefined, 'hash');

      expect(result).toBe(false);
    });

    it('should return false when hash is null', async () => {
      const result = await verifyPassword('password', null);

      expect(result).toBe(false);
    });

    it('should return false when hash is undefined', async () => {
      const result = await verifyPassword('password', undefined);

      expect(result).toBe(false);
    });

    it('should return false on bcrypt error', async () => {
      const plainPassword = 'password123';
      const hash = 'hashed-password';

      mockCompare.mockRejectedValue(new Error('Bcrypt error'));

      const result = await verifyPassword(plainPassword, hash);

      expect(result).toBe(false);
    });
  });
});

