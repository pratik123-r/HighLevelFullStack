import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $disconnect: jest.fn().mockResolvedValue(undefined),
};

// Mock PrismaClient before importing anything that uses it
jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {
    join: jest.fn((items, separator) => items.join(separator)),
    sql: jest.fn((strings, ...values) => ({
      strings,
      values,
    })),
  },
}));

jest.unstable_mockModule('../../src/config/database.js', () => ({
  prisma: mockPrisma,
  connectMongoDB: jest.fn(),
  disconnectDatabases: jest.fn(),
}));

const { UserRepository } = await import('../../src/repositories/UserRepository.js');

describe('UserRepository', () => {
  let userRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = new UserRepository();
  });

  describe('create', () => {
    it('should create user', async () => {
      const data = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        salt: 'salt-value',
      };

      const createdUser = {
        id: 'user-123',
        ...data,
        createdAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await userRepository.create(data);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(createdUser);
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const id = 'user-123';
      const user = {
        id,
        name: 'Test User',
        email: 'test@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await userRepository.findById(id);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findById('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'test@example.com';
      const user = {
        id: 'user-123',
        email,
        name: 'Test User',
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await userRepository.findByEmail(email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual(user);
    });
  });

  describe('findAll', () => {
    it('should find all users', async () => {
      const users = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
      ];

      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await userRepository.findAll();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith();
      expect(result).toEqual(users);
    });
  });

  describe('findAllPaginated', () => {
    it('should find users with pagination', async () => {
      const skip = 0;
      const take = 10;
      const users = [{ id: 'user-1' }];
      const total = 1;

      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(total);

      const result = await userRepository.findAllPaginated(skip, take);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.user.count).toHaveBeenCalledWith();
      expect(result).toEqual({ data: users, total });
    });

    it('should use default pagination values', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await userRepository.findAllPaginated();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

